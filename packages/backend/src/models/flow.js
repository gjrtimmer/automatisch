import { ValidationError } from 'objection';
import Base from './base.js';
import Step from './step.js';
import User from './user.js';
import Execution from './execution.js';
import ExecutionStep from './execution-step.js';
import globalVariable from '../helpers/global-variable.js';
import logger from '../helpers/logger.js';
import Telemetry from '../helpers/telemetry/index.js';
import flowQueue from '../queues/flow.js';
import {
  REMOVE_AFTER_30_DAYS_OR_150_JOBS,
  REMOVE_AFTER_7_DAYS_OR_50_JOBS,
} from '../helpers/remove-job-configuration.js';

const JOB_NAME = 'flow';
const EVERY_15_MINUTES_CRON = '*/15 * * * *';

class Flow extends Base {
  static tableName = 'flows';

  static jsonSchema = {
    type: 'object',
    required: ['name'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', minLength: 1 },
      userId: { type: 'string', format: 'uuid' },
      remoteWebhookId: { type: 'string' },
      active: { type: 'boolean' },
      publishedAt: { type: 'string' },
      deletedAt: { type: 'string' },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' },
    },
  };

  static relationMappings = () => ({
    steps: {
      relation: Base.HasManyRelation,
      modelClass: Step,
      join: {
        from: 'flows.id',
        to: 'steps.flow_id',
      },
      filter(builder) {
        builder.orderBy('position', 'asc');
      },
    },
    triggerStep: {
      relation: Base.HasOneRelation,
      modelClass: Step,
      join: {
        from: 'flows.id',
        to: 'steps.flow_id',
      },
      filter(builder) {
        builder.where('type', 'trigger').limit(1).first();
      },
    },
    executions: {
      relation: Base.HasManyRelation,
      modelClass: Execution,
      join: {
        from: 'flows.id',
        to: 'executions.flow_id',
      },
    },
    lastExecution: {
      relation: Base.HasOneRelation,
      modelClass: Execution,
      join: {
        from: 'flows.id',
        to: 'executions.flow_id',
      },
      filter(builder) {
        builder.orderBy('created_at', 'desc').limit(1).first();
      },
    },
    user: {
      relation: Base.HasOneRelation,
      modelClass: User,
      join: {
        from: 'flows.user_id',
        to: 'users.id',
      },
    },
  });

  static async populateStatusProperty(flows) {
    const referenceFlow = flows[0];

    if (referenceFlow) {
      const shouldBePaused = await referenceFlow.isPaused();

      for (const flow of flows) {
        if (!flow.active) {
          flow.status = 'draft';
        } else if (flow.active && shouldBePaused) {
          flow.status = 'paused';
        } else {
          flow.status = 'published';
        }
      }
    }
  }

  static async afterFind(args) {
    await this.populateStatusProperty(args.result);
  }

  async lastInternalId() {
    const lastExecution = await this.$relatedQuery('lastExecution');

    return lastExecution ? lastExecution.internalId : null;
  }

  async lastInternalIds(itemCount = 50) {
    const lastExecutions = await this.$relatedQuery('executions')
      .select('internal_id')
      .orderBy('created_at', 'desc')
      .limit(itemCount);

    return lastExecutions.map((execution) => execution.internalId);
  }

  static get IncompleteStepsError() {
    return new ValidationError({
      data: {
        flow: [
          {
            message:
              'All steps should be completed before updating flow status!',
          },
        ],
      },
      type: 'incompleteStepsError',
    });
  }

  async createInitialSteps() {
    await Step.query().insert({
      flowId: this.id,
      type: 'trigger',
      position: 1,
    });

    await Step.query().insert({
      flowId: this.id,
      type: 'action',
      position: 2,
    });
  }

  async createActionStep(previousStepId) {
    const previousStep = await this.$relatedQuery('steps')
      .findById(previousStepId)
      .throwIfNotFound();

    const createdStep = await this.$relatedQuery('steps').insertAndFetch({
      type: 'action',
      position: previousStep.position + 1,
    });

    const nextSteps = await this.$relatedQuery('steps')
      .where('position', '>=', createdStep.position)
      .whereNot('id', createdStep.id);

    const nextStepQueries = nextSteps.map(async (nextStep, index) => {
      return await nextStep.$query().patchAndFetch({
        position: createdStep.position + index + 1,
      });
    });

    await Promise.all(nextStepQueries);

    return createdStep;
  }

  async delete() {
    const triggerStep = await this.getTriggerStep();
    const trigger = await triggerStep?.getTriggerCommand();

    if (trigger?.type === 'webhook' && trigger.unregisterHook) {
      const $ = await globalVariable({
        flow: this,
        connection: await triggerStep.$relatedQuery('connection'),
        app: await triggerStep.getApp(),
        step: triggerStep,
      });

      try {
        await trigger.unregisterHook($);
      } catch (error) {
        // suppress error as the remote resource might have been already deleted
        logger.debug(
          `Failed to unregister webhook for flow ${this.id}: ${error.message}`
        );
      }
    }

    const executionIds = (
      await this.$relatedQuery('executions').select('executions.id')
    ).map((execution) => execution.id);

    await ExecutionStep.query().delete().whereIn('execution_id', executionIds);

    await this.$relatedQuery('executions').delete();
    await this.$relatedQuery('steps').delete();
    await this.$query().delete();
  }

  async duplicateFor(user) {
    const steps = await this.$relatedQuery('steps').orderBy(
      'steps.position',
      'asc'
    );

    const duplicatedFlow = await user.$relatedQuery('flows').insertAndFetch({
      name: `Copy of ${this.name}`,
      active: false,
    });

    const updateStepId = (value, newStepIds) => {
      let newValue = value;

      const stepIdEntries = Object.entries(newStepIds);
      for (const stepIdEntry of stepIdEntries) {
        const [oldStepId, newStepId] = stepIdEntry;

        const partialOldVariable = `{{step.${oldStepId}.`;
        const partialNewVariable = `{{step.${newStepId}.`;

        newValue = newValue.replaceAll(partialOldVariable, partialNewVariable);
      }

      return newValue;
    };

    const updateStepVariables = (parameters, newStepIds) => {
      const entries = Object.entries(parameters);

      return entries.reduce((result, [key, value]) => {
        if (typeof value === 'string') {
          return {
            ...result,
            [key]: updateStepId(value, newStepIds),
          };
        }

        if (Array.isArray(value)) {
          return {
            ...result,
            [key]: value.map((item) => updateStepVariables(item, newStepIds)),
          };
        }

        return {
          ...result,
          [key]: value,
        };
      }, {});
    };

    const newStepIds = {};
    for (const step of steps) {
      const duplicatedStep = await duplicatedFlow
        .$relatedQuery('steps')
        .insert({
          key: step.key,
          appKey: step.appKey,
          type: step.type,
          connectionId: step.connectionId,
          position: step.position,
          parameters: updateStepVariables(step.parameters, newStepIds),
        });

      if (duplicatedStep.isTrigger) {
        await duplicatedStep.updateWebhookUrl();
      }

      newStepIds[step.id] = duplicatedStep.id;
    }

    const duplicatedFlowWithSteps = duplicatedFlow
      .$query()
      .withGraphJoined({ steps: true })
      .orderBy('steps.position', 'asc')
      .throwIfNotFound();

    return duplicatedFlowWithSteps;
  }

  async getTriggerStep() {
    return await this.$relatedQuery('steps').findOne({
      type: 'trigger',
    });
  }

  async isPaused() {
    const user = await this.$relatedQuery('user').withSoftDeleted();
    const allowedToRunFlows = await user.isAllowedToRunFlows();
    return allowedToRunFlows ? false : true;
  }

  async updateStatus(newActiveValue) {
    if (this.active === newActiveValue) {
      return this;
    }

    const triggerStep = await this.getTriggerStep();

    if (triggerStep.status === 'incomplete') {
      throw Flow.IncompleteStepsError;
    }

    const trigger = await triggerStep.getTriggerCommand();
    const interval = trigger.getInterval?.(triggerStep.parameters);
    const repeatOptions = {
      pattern: interval || EVERY_15_MINUTES_CRON,
    };

    if (trigger.type === 'webhook') {
      const $ = await globalVariable({
        flow: this,
        connection: await triggerStep.$relatedQuery('connection'),
        app: await triggerStep.getApp(),
        step: triggerStep,
        testRun: false,
      });

      if (newActiveValue && trigger.registerHook) {
        await trigger.registerHook($);
      } else if (!newActiveValue && trigger.unregisterHook) {
        await trigger.unregisterHook($);
      }
    } else {
      if (newActiveValue) {
        await this.$query().patchAndFetch({
          publishedAt: new Date().toISOString(),
        });

        const jobName = `${JOB_NAME}-${this.id}`;

        await flowQueue.add(
          jobName,
          { flowId: this.id },
          {
            repeat: repeatOptions,
            jobId: this.id,
            removeOnComplete: REMOVE_AFTER_7_DAYS_OR_50_JOBS,
            removeOnFail: REMOVE_AFTER_30_DAYS_OR_150_JOBS,
          }
        );
      } else {
        const repeatableJobs = await flowQueue.getRepeatableJobs();
        const job = repeatableJobs.find((job) => job.id === this.id);

        await flowQueue.removeRepeatableByKey(job.key);
      }
    }

    return await this.$query().withGraphFetched('steps').patchAndFetch({
      active: newActiveValue,
    });
  }

  async $beforeUpdate(opt, queryContext) {
    await super.$beforeUpdate(opt, queryContext);

    if (!this.active) return;

    const oldFlow = opt.old;

    const incompleteStep = await oldFlow.$relatedQuery('steps').findOne({
      status: 'incomplete',
    });

    if (incompleteStep) {
      throw Flow.IncompleteStepsError;
    }

    const allSteps = await oldFlow.$relatedQuery('steps');

    if (allSteps.length < 2) {
      throw new ValidationError({
        data: {
          flow: [
            {
              message:
                'There should be at least one trigger and one action steps in the flow!',
            },
          ],
        },
        type: 'insufficientStepsError',
      });
    }

    return;
  }

  async $afterInsert(queryContext) {
    await super.$afterInsert(queryContext);
    Telemetry.flowCreated(this);
  }

  async $afterUpdate(opt, queryContext) {
    await super.$afterUpdate(opt, queryContext);
    Telemetry.flowUpdated(this);
  }
}

export default Flow;
