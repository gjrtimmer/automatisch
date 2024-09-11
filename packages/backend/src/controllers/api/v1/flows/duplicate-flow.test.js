import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import Crypto from 'crypto';
import app from '../../../../app.js';
import createAuthTokenByUserId from '../../../../helpers/create-auth-token-by-user-id.js';
import { createUser } from '../../../../../test/factories/user.js';
import { createFlow } from '../../../../../test/factories/flow.js';
import { createStep } from '../../../../../test/factories/step.js';
import { createPermission } from '../../../../../test/factories/permission.js';
import duplicateFlowMock from '../../../../../test/mocks/rest/api/v1/flows/duplicate-flow.js';

describe('POST /api/v1/flows/:flowId/duplicate', () => {
  let currentUser, currentUserRole, token;

  beforeEach(async () => {
    currentUser = await createUser();
    currentUserRole = await currentUser.$relatedQuery('role');

    token = await createAuthTokenByUserId(currentUser.id);
  });

  it('should return duplicated flow data of current user', async () => {
    const currentUserFlow = await createFlow({ userId: currentUser.id });

    const triggerStep = await createStep({
      flowId: currentUserFlow.id,
      type: 'trigger',
      appKey: 'webhook',
      key: 'catchRawWebhook',
    });

    const actionStep = await createStep({
      flowId: currentUserFlow.id,
      type: 'action',
      appKey: 'ntfy',
      key: 'sendMessage',
      parameters: {
        topic: 'Test notification',
        message: `Message: {{step.${triggerStep.id}.body.message}} by {{step.${triggerStep.id}.body.sender}}`,
      },
    });

    await createPermission({
      action: 'read',
      subject: 'Flow',
      roleId: currentUserRole.id,
      conditions: ['isCreator'],
    });

    await createPermission({
      action: 'create',
      subject: 'Flow',
      roleId: currentUserRole.id,
      conditions: ['isCreator'],
    });

    const response = await request(app)
      .post(`/api/v1/flows/${currentUserFlow.id}/duplicate`)
      .set('Authorization', token)
      .expect(201);

    const refetchedDuplicateFlow = await currentUser
      .$relatedQuery('flows')
      .findById(response.body.data.id);

    const refetchedDuplicateFlowSteps = await refetchedDuplicateFlow
      .$relatedQuery('steps')
      .orderBy('position', 'asc');

    const expectedPayload = await duplicateFlowMock(
      refetchedDuplicateFlow,
      refetchedDuplicateFlowSteps
    );

    const refetchedDuplicateFlowTriggerStep = refetchedDuplicateFlowSteps[0];
    const refetchedDuplicateFlowActionStep = refetchedDuplicateFlowSteps[1];

    expect(response.body).toStrictEqual(expectedPayload);

    expect(refetchedDuplicateFlow.userId).toStrictEqual(currentUser.id);

    expect(refetchedDuplicateFlowSteps.length).toStrictEqual(2);

    expect(refetchedDuplicateFlowTriggerStep.appKey).toStrictEqual(
      triggerStep.appKey
    );

    expect(refetchedDuplicateFlowTriggerStep.key).toStrictEqual(
      triggerStep.key
    );

    expect(refetchedDuplicateFlowTriggerStep.connectionId).toStrictEqual(
      triggerStep.connectionId
    );

    expect(refetchedDuplicateFlowTriggerStep.position).toStrictEqual(
      triggerStep.position
    );

    expect(refetchedDuplicateFlowTriggerStep.parameters).toStrictEqual(
      triggerStep.parameters
    );

    expect(refetchedDuplicateFlowTriggerStep.type).toStrictEqual(
      triggerStep.type
    );

    expect(refetchedDuplicateFlowActionStep.appKey).toStrictEqual(
      actionStep.appKey
    );

    expect(refetchedDuplicateFlowActionStep.key).toStrictEqual(actionStep.key);

    expect(refetchedDuplicateFlowActionStep.connectionId).toStrictEqual(
      actionStep.connectionId
    );

    expect(refetchedDuplicateFlowActionStep.position).toStrictEqual(
      actionStep.position
    );

    expect(refetchedDuplicateFlowActionStep.parameters.topic).toStrictEqual(
      actionStep.parameters.topic
    );

    expect(refetchedDuplicateFlowActionStep.parameters.message).toStrictEqual(
      actionStep.parameters.message.replaceAll(
        `{{step.${triggerStep.id}.`,
        `{{step.${refetchedDuplicateFlowTriggerStep.id}.`
      )
    );

    expect(refetchedDuplicateFlowActionStep.type).toStrictEqual(
      actionStep.type
    );

    expect(refetchedDuplicateFlowTriggerStep.webhookPath).toStrictEqual(
      `/webhooks/flows/${refetchedDuplicateFlow.id}`
    );
  });

  it('should return duplicated flow data of another user', async () => {
    const anotherUser = await createUser();
    const anotherUserFlow = await createFlow({ userId: anotherUser.id });

    const triggerStep = await createStep({
      flowId: anotherUserFlow.id,
      type: 'trigger',
      appKey: 'webhook',
      key: 'catchRawWebhook',
    });

    const actionStep = await createStep({
      flowId: anotherUserFlow.id,
      type: 'action',
      appKey: 'ntfy',
      key: 'sendMessage',
      parameters: {
        topic: 'Test notification',
        message: `Message: {{step.${triggerStep.id}.body.message}} by {{step.${triggerStep.id}.body.sender}}`,
      },
    });

    await createPermission({
      action: 'read',
      subject: 'Flow',
      roleId: currentUserRole.id,
      conditions: [],
    });

    await createPermission({
      action: 'create',
      subject: 'Flow',
      roleId: currentUserRole.id,
      conditions: [],
    });

    const response = await request(app)
      .post(`/api/v1/flows/${anotherUserFlow.id}/duplicate`)
      .set('Authorization', token)
      .expect(201);

    const refetchedDuplicateFlow = await currentUser
      .$relatedQuery('flows')
      .findById(response.body.data.id);

    const refetchedDuplicateFlowSteps = await refetchedDuplicateFlow
      .$relatedQuery('steps')
      .orderBy('position', 'asc');

    const expectedPayload = await duplicateFlowMock(
      refetchedDuplicateFlow,
      refetchedDuplicateFlowSteps
    );

    const refetchedDuplicateFlowTriggerStep = refetchedDuplicateFlowSteps[0];
    const refetchedDuplicateFlowActionStep = refetchedDuplicateFlowSteps[1];

    expect(response.body).toStrictEqual(expectedPayload);

    expect(refetchedDuplicateFlow.userId).toStrictEqual(currentUser.id);

    expect(refetchedDuplicateFlowSteps.length).toStrictEqual(2);

    expect(refetchedDuplicateFlowTriggerStep.appKey).toStrictEqual(
      triggerStep.appKey
    );

    expect(refetchedDuplicateFlowTriggerStep.key).toStrictEqual(
      triggerStep.key
    );

    expect(refetchedDuplicateFlowTriggerStep.connectionId).toStrictEqual(
      triggerStep.connectionId
    );

    expect(refetchedDuplicateFlowTriggerStep.position).toStrictEqual(
      triggerStep.position
    );

    expect(refetchedDuplicateFlowTriggerStep.parameters).toStrictEqual(
      triggerStep.parameters
    );

    expect(refetchedDuplicateFlowTriggerStep.type).toStrictEqual(
      triggerStep.type
    );

    expect(refetchedDuplicateFlowActionStep.appKey).toStrictEqual(
      actionStep.appKey
    );

    expect(refetchedDuplicateFlowActionStep.key).toStrictEqual(actionStep.key);

    expect(refetchedDuplicateFlowActionStep.connectionId).toStrictEqual(
      actionStep.connectionId
    );

    expect(refetchedDuplicateFlowActionStep.position).toStrictEqual(
      actionStep.position
    );

    expect(refetchedDuplicateFlowActionStep.parameters.topic).toStrictEqual(
      actionStep.parameters.topic
    );

    expect(refetchedDuplicateFlowActionStep.parameters.message).toStrictEqual(
      actionStep.parameters.message.replaceAll(
        `{{step.${triggerStep.id}.`,
        `{{step.${refetchedDuplicateFlowTriggerStep.id}.`
      )
    );

    expect(refetchedDuplicateFlowActionStep.type).toStrictEqual(
      actionStep.type
    );

    expect(refetchedDuplicateFlowTriggerStep.webhookPath).toStrictEqual(
      `/webhooks/flows/${refetchedDuplicateFlow.id}`
    );
  });

  it('should return not found response for not existing flow UUID', async () => {
    await createPermission({
      action: 'read',
      subject: 'Flow',
      roleId: currentUserRole.id,
      conditions: ['isCreator'],
    });

    await createPermission({
      action: 'create',
      subject: 'Flow',
      roleId: currentUserRole.id,
      conditions: ['isCreator'],
    });

    const notExistingFlowUUID = Crypto.randomUUID();

    await request(app)
      .post(`/api/v1/flows/${notExistingFlowUUID}/duplicate`)
      .set('Authorization', token)
      .expect(404);
  });

  it('should return not found response for unauthorized flow', async () => {
    const anotherUser = await createUser();
    const anotherUserFlow = await createFlow({ userId: anotherUser.id });

    await createPermission({
      action: 'read',
      subject: 'Flow',
      roleId: currentUserRole.id,
      conditions: ['isCreator'],
    });

    await createPermission({
      action: 'create',
      subject: 'Flow',
      roleId: currentUserRole.id,
      conditions: ['isCreator'],
    });

    await request(app)
      .post(`/api/v1/flows/${anotherUserFlow.id}/duplicate`)
      .set('Authorization', token)
      .expect(404);
  });

  it('should return bad request response for invalid UUID', async () => {
    await createPermission({
      action: 'read',
      subject: 'Flow',
      roleId: currentUserRole.id,
      conditions: ['isCreator'],
    });

    await createPermission({
      action: 'create',
      subject: 'Flow',
      roleId: currentUserRole.id,
      conditions: ['isCreator'],
    });

    await request(app)
      .post('/api/v1/flows/invalidFlowUUID/duplicate')
      .set('Authorization', token)
      .expect(400);
  });
});