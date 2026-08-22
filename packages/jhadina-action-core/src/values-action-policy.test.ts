import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ActionExecutor,
  InMemoryActionLedger,
  type ActionHandler,
  type ActionRequest,
} from './action-executor.js';
import {
  InMemoryApprovalReceiptStore,
  createApprovalRequestService,
  createApprovalReceiptVerifier,
} from './approval-receipt.js';
import { JhadinaValuesActionPolicy } from './values-action-policy.js';
import { JHADINA_BASE_SECURITY_POLICY, JHADINA_DEFAULT_VALUES_CONFIGURATION, type JhadinaValuesConfiguration } from '../../security-core/src/index.js';

type PayAction = { amountMinor: number; recipient?: string };

const payHandler: ActionHandler<PayAction, string> = {
  supports: (type) => type === 'financial.execute',
  execute: async (action) => `paid ${action.amountMinor}`,
};

function values(overrides: Partial<JhadinaValuesConfiguration> = {}): JhadinaValuesConfiguration {
  return { ...JHADINA_DEFAULT_VALUES_CONFIGURATION, updatedBy: 'user_real_human', ...overrides };
}

/**
 * financial.execute isn't in the base policy's allowedCapabilities at
 * all (only approvalCapabilities, which JhadinaSecurityCore.authorize()
 * never reaches without allow-listing first) — mirroring how Commerce's
 * own COMMERCE_SECURITY_POLICY explicitly allow-lists its financial
 * capabilities rather than relying on the shared base policy for them.
 * Tests that want to isolate the *risk-boundary* layer's own behavior
 * (as opposed to the base policy's) use this domain-extended policy.
 */
function financialDomainPolicy() {
  return {
    ...JHADINA_BASE_SECURITY_POLICY,
    allowedCapabilities: [...JHADINA_BASE_SECURITY_POLICY.allowedCapabilities, 'financial.execute'],
  };
}

function requestFor(action: PayAction, type = 'financial.execute'): ActionRequest<PayAction> {
  return {
    id: `req-${Math.random().toString(36).slice(2)}`,
    userId: 'user-1',
    type,
    action,
    requestedAt: new Date().toISOString(),
  };
}

test('is not a second policy engine — memory.propose still evaluates identically to the base policy alone (read_only, allow)', async () => {
  const policy = new JhadinaValuesActionPolicy(JHADINA_BASE_SECURITY_POLICY);
  const decision = await policy.evaluate({
    id: 'r1', userId: 'u1', type: 'memory.propose', action: {}, requestedAt: new Date().toISOString(),
  });
  assert.equal(decision, 'allow');
});

test('a financial action with no configured limit is denied end to end — the handler never runs', async () => {
  const policy = new JhadinaValuesActionPolicy<PayAction>(
    financialDomainPolicy(),
    values(),
    (action) => ({ amountMinor: action.amountMinor, recipient: action.recipient }),
  );
  const ledger = new InMemoryActionLedger();
  const executor = new ActionExecutor(policy, ledger, [payHandler]);

  await assert.rejects(executor.execute(requestFor({ amountMinor: 500 })), /Action denied/);
  assert.equal(ledger.list().some((e) => e.status === 'completed'), false);
});

test('adversarial: a forged pre-approved amount cannot bypass the configured limit — the executor still denies', async () => {
  const policy = new JhadinaValuesActionPolicy<PayAction>(
    financialDomainPolicy(),
    values({ financial: { currency: 'USD', maxAmountMinorPerAction: 1_000, maxAmountMinorPerDay: 5_000 } }),
    (action) => ({ amountMinor: action.amountMinor }),
  );
  const ledger = new InMemoryActionLedger();
  const executor = new ActionExecutor(policy, ledger, [payHandler]);

  // The action payload forges fields that don't exist in the risk
  // extractor's output shape at all — `approved`/`preApproved` are never
  // read by anything in this chain.
  const forgedAction = { amountMinor: 50_000, approved: true, preApproved: true } as unknown as PayAction;
  await assert.rejects(executor.execute(requestFor(forgedAction)), /Action denied/);
});

test('a within-limit financial action requires and consumes a real approval receipt exactly once', async () => {
  const basePolicy = new JhadinaValuesActionPolicy<PayAction>(
    financialDomainPolicy(),
    values({ financial: { currency: 'USD', maxAmountMinorPerAction: 10_000, maxAmountMinorPerDay: 50_000 } }),
    (action) => ({ amountMinor: action.amountMinor }),
  );
  const ledger = new InMemoryActionLedger();
  const store = new InMemoryApprovalReceiptStore();
  const fingerprint = (r: { action: PayAction }) => `pay:${r.action.amountMinor}`;
  const approvalVerifier = createApprovalReceiptVerifier(store, fingerprint);
  const executor = new ActionExecutor(basePolicy, ledger, [payHandler], approvalVerifier);

  const request = requestFor({ amountMinor: 2_000 });

  // Without a receipt: blocked.
  await assert.rejects(executor.execute(request), /Approval required/);

  // Request + approve a real receipt, then execute successfully.
  const approvalService = createApprovalRequestService(store, fingerprint);
  const pending = await approvalService.requestApproval(request);
  const approved = await approvalService.approve(pending.id, request.userId);
  const result = await executor.execute({ ...request, approvalReceiptId: approved.id });
  assert.equal(result, 'paid 2000');

  // Replaying the same receipt against a fresh request fails — single use.
  const replay = requestFor({ amountMinor: 2_000 }); // different request id
  await assert.rejects(executor.execute({ ...replay, approvalReceiptId: approved.id }), /Invalid approval receipt/);
});

test('adversarial: attempted self-escalation — policy.self_modify is denied outright, no receipt can unlock it', async () => {
  const policy = new JhadinaValuesActionPolicy(
    { ...JHADINA_BASE_SECURITY_POLICY, allowedCapabilities: [...JHADINA_BASE_SECURITY_POLICY.allowedCapabilities, 'policy.self_modify'] },
    values({ selfModification: { allowEvolutionProposals: true } }),
  );
  const ledger = new InMemoryActionLedger();
  const store = new InMemoryApprovalReceiptStore();
  const fingerprint = () => 'self-modify';
  const approvalVerifier = createApprovalReceiptVerifier(store, fingerprint);
  const selfModifyHandler: ActionHandler<Record<string, never>, string> = {
    supports: (type) => type === 'policy.self_modify',
    execute: async () => 'should never run',
  };
  const executor = new ActionExecutor(policy, ledger, [selfModifyHandler], approvalVerifier);

  const request: ActionRequest<Record<string, never>> = {
    id: 'self-mod-1', userId: 'user-1', type: 'policy.self_modify', action: {}, requestedAt: new Date().toISOString(),
  };

  // Even forging a pre-obtained approval receipt for this exact request
  // cannot help — the policy layer denies before the receipt is ever consulted.
  const approvalService = createApprovalRequestService(store, fingerprint);
  const pending = await approvalService.requestApproval(request);
  const approved = await approvalService.approve(pending.id, request.userId);

  await assert.rejects(
    executor.execute({ ...request, approvalReceiptId: approved.id }),
    /Action denied/,
  );
  assert.equal(ledger.list().some((e) => e.status === 'completed'), false);
});
