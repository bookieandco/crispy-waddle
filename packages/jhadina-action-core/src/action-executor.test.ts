import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ActionExecutor,
  AllowAllActionPolicy,
  InMemoryActionLedger,
  type ActionAuditEvent,
  type ActionHandler,
  type ActionLedger,
  type ActionRequest,
} from './action-executor.js';

const baseRequest = (id: string): ActionRequest<{ value: string }> => ({
  id,
  userId: 'user-a',
  type: 'test.action',
  action: { value: 'ok' },
  requestedAt: new Date().toISOString(),
});

const okHandler: ActionHandler<{ value: string }, string> = {
  supports: (type) => type === 'test.action',
  execute: async (action) => action.value,
};

test('fails closed and never invokes the handler if the started-audit append fails', async () => {
  let handlerInvoked = false;
  const handler: ActionHandler<{ value: string }, string> = {
    supports: (type) => type === 'test.action',
    execute: async (action) => {
      handlerInvoked = true;
      return action.value;
    },
  };
  const ledger: ActionLedger = {
    append: async () => {
      throw new Error('LEDGER_DOWN');
    },
  };
  const executor = new ActionExecutor(new AllowAllActionPolicy(), ledger, [handler]);

  await assert.rejects(() => executor.execute(baseRequest('req-1')), /LEDGER_DOWN/);
  assert.equal(handlerInvoked, false);
});

test('does not report a successful action as failed when the completion-audit append fails', async () => {
  const events: ActionAuditEvent[] = [];
  const ledger: ActionLedger = {
    append: async (event) => {
      if (event.status === 'completed') throw new Error('COMPLETION_AUDIT_DOWN');
      events.push(event);
    },
  };
  const executor = new ActionExecutor(new AllowAllActionPolicy(), ledger, [okHandler]);

  await assert.rejects(
    () => executor.execute(baseRequest('req-2')),
    /ACTION_COMPLETED_AUDIT_FAILED/,
  );

  // The handler's side effect succeeded; no 'failed' status should ever be recorded.
  assert.equal(events.some((event) => event.status === 'failed'), false);
  assert.equal(events.some((event) => event.status === 'started'), true);
});

test('a real completion succeeds and records a completed event when the ledger is healthy', async () => {
  const ledger = new InMemoryActionLedger();
  const executor = new ActionExecutor(new AllowAllActionPolicy(), ledger, [okHandler]);

  const result = await executor.execute(baseRequest('req-3'));

  assert.equal(result, 'ok');
  const statuses = ledger.list().map((event) => event.status);
  assert.deepEqual(statuses, ['started', 'completed']);
});

test('a handler failure is still recorded as failed and the original error survives', async () => {
  const failingHandler: ActionHandler<{ value: string }, string> = {
    supports: (type) => type === 'test.action',
    execute: async () => {
      throw new Error('HANDLER_BROKE');
    },
  };
  const ledger = new InMemoryActionLedger();
  const executor = new ActionExecutor(new AllowAllActionPolicy(), ledger, [failingHandler]);

  await assert.rejects(() => executor.execute(baseRequest('req-4')), /HANDLER_BROKE/);

  const statuses = ledger.list().map((event) => event.status);
  assert.deepEqual(statuses, ['started', 'failed']);
});

test('preserves the original handler error when both the handler and the failed-audit append fail', async () => {
  const failingHandler: ActionHandler<{ value: string }, string> = {
    supports: (type) => type === 'test.action',
    execute: async () => {
      throw new Error('HANDLER_BROKE');
    },
  };
  const ledger: ActionLedger = {
    append: async (event) => {
      if (event.status === 'failed') throw new Error('FAILED_AUDIT_DOWN');
    },
  };
  const executor = new ActionExecutor(new AllowAllActionPolicy(), ledger, [failingHandler]);

  await assert.rejects(
    () => executor.execute(baseRequest('req-5')),
    /ACTION_FAILED_AND_AUDIT_FAILED:HANDLER_BROKE:FAILED_AUDIT_DOWN/,
  );
});
