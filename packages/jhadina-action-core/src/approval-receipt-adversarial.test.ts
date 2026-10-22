import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ActionExecutor,
  InMemoryActionLedger,
  type ActionHandler,
  type ActionPolicy,
  type ActionRequest,
} from './action-executor.js';
import {
  InMemoryApprovalReceiptStore,
  createActionBoundFingerprint,
  createApprovalReceiptVerifier,
  createApprovalRequestService,
} from './approval-receipt.js';

type Payload = { recipient: string; amountMinor: bigint; note?: string };

function request(id = 'approve-action-1'): ActionRequest<Payload> {
  return {
    id,
    userId: 'owner',
    type: 'test.payment',
    action: { recipient: 'payee-a', amountMinor: 500n },
    requestedAt: '2026-10-21T00:00:00.000Z',
  };
}
const fingerprint = createActionBoundFingerprint<Payload>(() => 'test.payment');
const policy = (decision: 'allow' | 'deny' | 'approval_required'): ActionPolicy<Payload> => ({
  evaluate: async () => decision,
});

function setup(decision: 'allow' | 'deny' | 'approval_required' = 'approval_required') {
  const store = new InMemoryApprovalReceiptStore();
  const ledger = new InMemoryActionLedger();
  let invocations = 0;
  const handler: ActionHandler<Payload, string> = {
    supports: (type) => type === 'test.payment',
    execute: async () => {
      invocations++;
      return 'executed';
    },
  };
  const executor = new ActionExecutor(policy(decision), ledger, [handler], createApprovalReceiptVerifier(store, fingerprint));
  const service = createApprovalRequestService(store, fingerprint);
  return { store, ledger, executor, service, getInvocations: () => invocations };
}

test('ALLOW executes once and writes started/completed', async () => {
  const x = setup('allow');
  assert.equal(await x.executor.execute(request()), 'executed');
  assert.equal(x.getInvocations(), 1);
  assert.deepEqual(x.ledger.list().map((e) => e.status), ['started', 'completed']);
});

test('DENY blocks handler, even with an approved receipt', async () => {
  const x = setup('deny');
  const r = request();
  const pending = await x.service.requestApproval(r);
  await x.service.approve(pending.id, r.userId);
  await assert.rejects(x.executor.execute({ ...r, approvalReceiptId: pending.id }), /Action denied/);
  assert.equal(x.getInvocations(), 0);
  assert.equal(x.ledger.list().at(-1)?.status, 'denied');
  // Denial does not consume a receipt. Policy remains authoritative.
  assert.equal(await x.store.consume(pending.id, {
    actionId: r.id, userId: r.userId, type: r.type, fingerprint: fingerprint(r),
  }), true);
});

test('APPROVAL_REQUIRED without a receipt never executes', async () => {
  const x = setup();
  await assert.rejects(x.executor.execute(request()), /Approval required/);
  assert.equal(x.getInvocations(), 0);
  assert.equal(x.ledger.list().at(-1)?.status, 'approval_required');
});

test('pending approval cannot execute; wrong approver cannot approve', async () => {
  const x = setup();
  const r = request();
  const pending = await x.service.requestApproval(r);
  await assert.rejects(x.service.approve(pending.id, 'attacker'), /cannot be approved/);
  await assert.rejects(x.executor.execute({ ...r, approvalReceiptId: pending.id }), /Invalid approval receipt/);
  assert.equal(x.getInvocations(), 0);
});

test('approved receipt executes exactly once; replay is denied and audited', async () => {
  const x = setup();
  const r = request();
  const pending = await x.service.requestApproval(r);
  await x.service.approve(pending.id, r.userId);
  const authorized = { ...r, approvalReceiptId: pending.id };
  assert.equal(await x.executor.execute(authorized), 'executed');
  await assert.rejects(x.executor.execute(authorized), /Invalid approval receipt/);
  assert.equal(x.getInvocations(), 1);
  assert.equal(x.ledger.list().at(-1)?.status, 'denied');
});

test('receipt refuses wrong user, action ID, type, or full payload fingerprint', async () => {
  const x = setup();
  const r = request();
  const pending = await x.service.requestApproval(r);
  await x.service.approve(pending.id, r.userId);
  const mismatchRequests: ActionRequest<Payload>[] = [
    { ...r, userId: 'attacker' },
    { ...r, id: 'other-action' },
    { ...r, type: 'other-capability' },
    { ...r, action: { ...r.action, amountMinor: 501n } },
    { ...r, action: { ...r.action, recipient: 'payee-b' } },
  ];
  for (const candidate of mismatchRequests) {
    await assert.rejects(
      x.executor.execute({ ...candidate, approvalReceiptId: pending.id }),
      /Invalid approval receipt/,
    );
  }
  assert.equal(x.getInvocations(), 0);
  // Invalid attempts never consume the valid receipt.
  assert.equal(await x.executor.execute({ ...r, approvalReceiptId: pending.id }), 'executed');
  assert.equal(x.getInvocations(), 1);
});

test('concurrent consumption permits exactly one handler invocation in one process', async () => {
  const x = setup();
  const r = request();
  const pending = await x.service.requestApproval(r);
  await x.service.approve(pending.id, r.userId);
  const outcomes = await Promise.allSettled(
    Array.from({ length: 8 }, () => x.executor.execute({ ...r, approvalReceiptId: pending.id })),
  );
  assert.equal(outcomes.filter((o) => o.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((o) => o.status === 'rejected').length, 7);
  assert.equal(x.getInvocations(), 1);
});

test('expired pending receipt cannot be approved', async () => {
  const store = new InMemoryApprovalReceiptStore();
  const pending = await store.createPending({
    actionId: 'expired', userId: 'owner', type: 'test.payment',
    fingerprint: 'bound', expiresAt: new Date(Date.now() - 1000).toISOString(),
  });
  await assert.rejects(store.approve(pending.id, 'owner'), /expired/);
});

test('expired approved receipt cannot execute', async () => {
  const x = setup();
  const r = request();
  const pending = await x.service.requestApproval(r);
  await x.service.approve(pending.id, r.userId);
  const originalNow = Date.now;
  Date.now = () => originalNow() + 6 * 60_000;
  try {
    await assert.rejects(x.executor.execute({ ...r, approvalReceiptId: pending.id }), /Invalid approval receipt/);
  } finally {
    Date.now = originalNow;
  }
  assert.equal(x.getInvocations(), 0);
});

test('malformed expiry and empty binding fail closed at creation', async () => {
  const store = new InMemoryApprovalReceiptStore();
  const valid = { actionId: 'a', userId: 'owner', type: 'test.payment', fingerprint: 'bound' };
  await assert.rejects(store.createPending({ ...valid, expiresAt: 'not-a-date' }), /expiry invalid/);
  await assert.rejects(
    store.createPending({ ...valid, fingerprint: '', expiresAt: new Date(Date.now() + 1000).toISOString() }),
    /binding incomplete/,
  );
});

test('canonical action fingerprints are deterministic across key order and bind all fields', () => {
  const mk = (action: Payload) => ({ ...request(), action });
  const a = mk({ amountMinor: 500n, recipient: 'payee-a' });
  const b = mk({ recipient: 'payee-a', amountMinor: 500n });
  assert.equal(fingerprint(a), fingerprint(b));
  assert.notEqual(fingerprint(a), fingerprint(mk({ ...a.action, note: 'changed' })));
  assert.notEqual(fingerprint(a), fingerprint(mk({ ...a.action, amountMinor: 501n })));
  assert.notEqual(fingerprint(a), fingerprint(mk({ ...a.action, recipient: 'payee-b' })));
  assert.match(fingerprint(a), /^[a-f0-9]{64}$/);
});

test('canonical action fingerprints reject invalid, circular and nonserializable payloads', () => {
  const bound = createActionBoundFingerprint<unknown>(() => 'scope');
  const base = request();
  assert.throws(() => bound({ ...base, action: { n: Number.NaN } }), /Unsupported approval action number/);
  assert.throws(() => bound({ ...base, action: { fn: () => 'surprise' } }), /Unsupported approval action value/);
  const circular: { self?: unknown } = {};
  circular.self = circular;
  assert.throws(() => bound({ ...base, action: circular }), /Circular approval action payload/);
  assert.throws(() => createActionBoundFingerprint<Payload>(() => '')(base), /fingerprint invalid/);
});

test('handler failure remains auditable after valid receipt consumption', async () => {
  const store = new InMemoryApprovalReceiptStore();
  const ledger = new InMemoryActionLedger();
  let attempts = 0;
  const handler: ActionHandler<Payload, string> = {
    supports: () => true,
    execute: async () => { attempts++; throw new Error('HANDLER_FAILED'); },
  };
  const executor = new ActionExecutor(policy('approval_required'), ledger, [handler], createApprovalReceiptVerifier(store, fingerprint));
  const service = createApprovalRequestService(store, fingerprint);
  const r = request();
  const pending = await service.requestApproval(r);
  await service.approve(pending.id, r.userId);
  await assert.rejects(executor.execute({ ...r, approvalReceiptId: pending.id }), /HANDLER_FAILED/);
  assert.equal(attempts, 1);
  assert.deepEqual(ledger.list().map((e) => e.status), ['started', 'failed']);
  await assert.rejects(executor.execute({ ...r, approvalReceiptId: pending.id }), /Invalid approval receipt/);
  assert.equal(attempts, 1);
});

test('in-memory receipts do not survive separate instances (production durability remains unverified)', async () => {
  const one = new InMemoryApprovalReceiptStore();
  const two = new InMemoryApprovalReceiptStore();
  const r = request();
  const service = createApprovalRequestService(one, fingerprint);
  const pending = await service.requestApproval(r);
  await service.approve(pending.id, r.userId);
  assert.equal(await createApprovalReceiptVerifier(two, fingerprint).verifyAndConsume(pending.id, r), false);
  assert.equal(await createApprovalReceiptVerifier(one, fingerprint).verifyAndConsume(pending.id, r), true);
});
