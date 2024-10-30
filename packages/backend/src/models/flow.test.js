import { describe, it, expect, vi } from 'vitest';
import Flow from './flow.js';
import User from './user.js';
import Base from './base.js';
import Step from './step.js';
import Execution from './execution.js';
import { createFlow } from '../../test/factories/flow.js';
import { createExecution } from '../../test/factories/execution.js';

describe('Flow model', () => {
  it('tableName should return correct name', () => {
    expect(Flow.tableName).toBe('flows');
  });

  it('jsonSchema should have correct validations', () => {
    expect(Flow.jsonSchema).toMatchSnapshot();
  });

  describe('relationMappings', () => {
    it('should return correct associations', () => {
      const relationMappings = Flow.relationMappings();

      const expectedRelations = {
        steps: {
          relation: Base.HasManyRelation,
          modelClass: Step,
          join: {
            from: 'flows.id',
            to: 'steps.flow_id',
          },
          filter: expect.any(Function),
        },
        triggerStep: {
          relation: Base.HasOneRelation,
          modelClass: Step,
          join: {
            from: 'flows.id',
            to: 'steps.flow_id',
          },
          filter: expect.any(Function),
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
          filter: expect.any(Function),
        },
        user: {
          relation: Base.HasOneRelation,
          modelClass: User,
          join: {
            from: 'flows.user_id',
            to: 'users.id',
          },
        },
      };

      expect(relationMappings).toStrictEqual(expectedRelations);
    });

    it('steps should return the steps', () => {
      const relations = Flow.relationMappings();
      const orderBySpy = vi.fn();

      relations.steps.filter({ orderBy: orderBySpy });

      expect(orderBySpy).toHaveBeenCalledWith('position', 'asc');
    });

    it('triggerStep should return the trigger step', () => {
      const relations = Flow.relationMappings();

      const firstSpy = vi.fn();

      const limitSpy = vi.fn().mockImplementation(() => ({
        first: firstSpy,
      }));

      const whereSpy = vi.fn().mockImplementation(() => ({
        limit: limitSpy,
      }));

      relations.triggerStep.filter({ where: whereSpy });

      expect(whereSpy).toHaveBeenCalledWith('type', 'trigger');
      expect(limitSpy).toHaveBeenCalledWith(1);
      expect(firstSpy).toHaveBeenCalledOnce();
    });

    it('lastExecution should return the last execution', () => {
      const relations = Flow.relationMappings();

      const firstSpy = vi.fn();

      const limitSpy = vi.fn().mockImplementation(() => ({
        first: firstSpy,
      }));

      const orderBySpy = vi.fn().mockImplementation(() => ({
        limit: limitSpy,
      }));

      relations.lastExecution.filter({ orderBy: orderBySpy });

      expect(orderBySpy).toHaveBeenCalledWith('created_at', 'desc');
      expect(limitSpy).toHaveBeenCalledWith(1);
      expect(firstSpy).toHaveBeenCalledOnce();
    });
  });

  describe('populateStatusProperty', () => {
    it('should assign "draft" to status property when a flow is not active', async () => {
      const referenceFlow = await createFlow({ active: false });

      const flows = [referenceFlow];

      vi.spyOn(referenceFlow, 'isPaused').mockResolvedValue();

      await Flow.populateStatusProperty(flows);

      expect(referenceFlow.status).toBe('draft');
    });

    it('should assign "paused" to status property when a flow is active, but should be paused', async () => {
      const referenceFlow = await createFlow({ active: true });

      const flows = [referenceFlow];

      vi.spyOn(referenceFlow, 'isPaused').mockResolvedValue(true);

      await Flow.populateStatusProperty(flows);

      expect(referenceFlow.status).toBe('paused');
    });

    it('should assign "published" to status property when a flow is active', async () => {
      const referenceFlow = await createFlow({ active: true });

      const flows = [referenceFlow];

      vi.spyOn(referenceFlow, 'isPaused').mockResolvedValue(false);

      await Flow.populateStatusProperty(flows);

      expect(referenceFlow.status).toBe('published');
    });
  });

  it('afterFind should call Flow.populateStatusProperty', async () => {
    const populateStatusPropertySpy = vi
      .spyOn(Flow, 'populateStatusProperty')
      .mockImplementation(() => {});

    await createFlow();

    expect(populateStatusPropertySpy).toHaveBeenCalledOnce();
  });

  describe('lastInternalId', () => {
    it('should return internal ID of last execution when exists', async () => {
      const flow = await createFlow();

      await createExecution({ flowId: flow.id });
      await createExecution({ flowId: flow.id });
      const lastExecution = await createExecution({ flowId: flow.id });

      expect(await flow.lastInternalId()).toBe(lastExecution.internalId);
    });

    it('should return null when no flow execution exists', async () => {
      const flow = await createFlow();

      expect(await flow.lastInternalId()).toBe(null);
    });
  });

  describe('lastInternalIds', () => {
    it('should return last internal IDs', async () => {
      const flow = await createFlow();

      const internalIds = [
        await createExecution({ flowId: flow.id }),
        await createExecution({ flowId: flow.id }),
        await createExecution({ flowId: flow.id }),
      ].map((execution) => execution.internalId);

      expect(await flow.lastInternalIds()).toStrictEqual(internalIds);
    });

    it('should return last 50 internal IDs by default', async () => {
      const flow = new Flow();

      const limitSpy = vi.fn().mockResolvedValue([]);

      vi.spyOn(flow, '$relatedQuery').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: limitSpy,
      });

      await flow.lastInternalIds();

      expect(limitSpy).toHaveBeenCalledWith(50);
    });
  });

  it('IncompleteStepsError should return validation error for incomplete steps', () => {
    expect(() => {
      throw Flow.IncompleteStepsError;
    }).toThrowError(
      'flow: All steps should be completed before updating flow status!'
    );
  });

  it('createInitialSteps should create one trigger and one action step', async () => {
    const flow = await createFlow();
    await flow.createInitialSteps();
    const steps = await flow.$relatedQuery('steps');

    expect(steps.length).toBe(2);

    expect(steps[0]).toMatchObject({
      flowId: flow.id,
      type: 'trigger',
      position: 1,
    });

    expect(steps[1]).toMatchObject({
      flowId: flow.id,
      type: 'action',
      position: 2,
    });
  });

  it.todo('createActionStep');

  it.todo('delete');
});
