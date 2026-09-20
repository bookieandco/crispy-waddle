/**
 * Deterministic, single-use Money execution permit.
 *
 * MONEY-R1C invariant:
 * a permit is downstream of Action Core authority and is cryptographically
 * bound to both the exact economic action and the exact ActionRequest that
 * survived policy/approval.
 */
import { createHash, randomUUID } from 'node:crypto';

export type PermitState =
  | 'ISSUED'
  | 'CONSUMED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'HALTED';

export interface ExecutionAction {
  actionId: string;
  userId: string;
  capability: string;
  provider: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  payeeId?: string;
  instrumentId?: string;
  amount: string;
  currency: string;
}

export interface PermitBinding {
  actionFingerprint: string;
  actionRequestFingerprint: string;
  authorityId: string;
  userId: string;
  capability: string;
  provider: string;
  policyVersion: string;
  policyHash: string;
  approvalId?: string;
  opportunityId?: string;
  riskDecisionId?: string;
  allocationDecisionId?: string;
}

export interface ExecutionPermit {
  permitId: string;
  nonce: string;
  state: PermitState;
  issuedAt: string;
  expiresAt: string;
  binding: PermitBinding;
}

export interface PermitIssuerInput {
  action: ExecutionAction;
  actionRequestFingerprint: string;
  authorityId: string;
  policyVersion: string;
  policyHash: string;
  expiresAt: string;
  approvalId?: string;
  opportunityId?: string;
  riskDecisionId?: string;
  allocationDecisionId?: string;
  now?: string;
  permitId?: string;
  nonce?: string;
}

export interface PermitVerificationContext {
  action: ExecutionAction;
  actionRequestFingerprint: string;
  authorityId: string;
  policyVersion: string;
  policyHash: string;
  now: string;
  approvalId?: string;
  opportunityId?: string;
  riskDecisionId?: string;
  allocationDecisionId?: string;
}

export interface PermitStore {
  issue(permit: ExecutionPermit): Promise<void> | void;
  get(
    permitId: string,
  ): Promise<ExecutionPermit | undefined> | ExecutionPermit | undefined;
  consume(
    permitId: string,
    nonce: string,
  ): Promise<boolean> | boolean;
  revoke(permitId: string): Promise<void> | void;
  haltAll(): Promise<void> | void;
}

function assertNonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

export function canonicalizeAction(action: ExecutionAction): string {
  return JSON.stringify({
    actionId: action.actionId,
    userId: action.userId,
    capability: action.capability,
    provider: action.provider,
    accountId: action.accountId ?? null,
    fromAccountId: action.fromAccountId ?? null,
    toAccountId: action.toAccountId ?? null,
    payeeId: action.payeeId ?? null,
    instrumentId: action.instrumentId ?? null,
    amount: action.amount,
    currency: action.currency,
  });
}

export function fingerprintAction(action: ExecutionAction): string {
  return createHash('sha256')
    .update(canonicalizeAction(action), 'utf8')
    .digest('hex');
}

export function issueExecutionPermit(
  input: PermitIssuerInput,
): ExecutionPermit {
  const now = input.now ?? new Date().toISOString();
  const issuedAt = Date.parse(now);
  const expiresAt = Date.parse(input.expiresAt);
  if (Number.isNaN(issuedAt) || Number.isNaN(expiresAt)) {
    throw new Error('MONEY_PERMIT_TIMESTAMP_INVALID');
  }
  if (expiresAt <= issuedAt) {
    throw new Error('Permit expiry must be after issuance time');
  }

  assertNonEmpty(
    input.actionRequestFingerprint,
    'MONEY_PERMIT_ACTION_REQUEST_FINGERPRINT_REQUIRED',
  );
  assertNonEmpty(input.authorityId, 'MONEY_PERMIT_AUTHORITY_REQUIRED');
  assertNonEmpty(input.policyVersion, 'MONEY_PERMIT_POLICY_VERSION_REQUIRED');
  assertNonEmpty(input.policyHash, 'MONEY_PERMIT_POLICY_HASH_REQUIRED');

  const actionFingerprint = fingerprintAction(input.action);
  return Object.freeze({
    permitId: input.permitId ?? randomUUID(),
    nonce: input.nonce ?? randomUUID(),
    state: 'ISSUED' as const,
    issuedAt: now,
    expiresAt: input.expiresAt,
    binding: Object.freeze({
      actionFingerprint,
      actionRequestFingerprint: input.actionRequestFingerprint,
      authorityId: input.authorityId,
      userId: input.action.userId,
      capability: input.action.capability,
      provider: input.action.provider,
      policyVersion: input.policyVersion,
      policyHash: input.policyHash,
      approvalId: input.approvalId,
      opportunityId: input.opportunityId,
      riskDecisionId: input.riskDecisionId,
      allocationDecisionId: input.allocationDecisionId,
    }),
  });
}

export function verifyExecutionPermit(
  permit: ExecutionPermit,
  context: PermitVerificationContext,
): void {
  if (permit.state !== 'ISSUED') {
    throw new Error(`Permit is not executable: ${permit.state}`);
  }
  const now = Date.parse(context.now);
  const expiresAt = Date.parse(permit.expiresAt);
  if (Number.isNaN(now) || Number.isNaN(expiresAt)) {
    throw new Error('MONEY_PERMIT_TIMESTAMP_INVALID');
  }
  if (now >= expiresAt) {
    throw new Error('Permit has expired');
  }

  const fingerprint = fingerprintAction(context.action);
  if (fingerprint !== permit.binding.actionFingerprint) {
    throw new Error('Action fingerprint mismatch');
  }
  if (
    context.actionRequestFingerprint !==
    permit.binding.actionRequestFingerprint
  ) {
    throw new Error('ActionRequest fingerprint mismatch');
  }
  if (context.authorityId !== permit.binding.authorityId) {
    throw new Error('Permit authority mismatch');
  }
  if (context.action.userId !== permit.binding.userId) {
    throw new Error('Permit user mismatch');
  }
  if (context.action.capability !== permit.binding.capability) {
    throw new Error('Permit capability mismatch');
  }
  if (context.action.provider !== permit.binding.provider) {
    throw new Error('Permit provider mismatch');
  }
  if (context.policyVersion !== permit.binding.policyVersion) {
    throw new Error('Policy version mismatch');
  }
  if (context.policyHash !== permit.binding.policyHash) {
    throw new Error('Policy hash mismatch');
  }

  const bindings: Array<
    [string, string | undefined, string | undefined]
  > = [
    ['approval', context.approvalId, permit.binding.approvalId],
    ['opportunity', context.opportunityId, permit.binding.opportunityId],
    [
      'risk decision',
      context.riskDecisionId,
      permit.binding.riskDecisionId,
    ],
    [
      'allocation decision',
      context.allocationDecisionId,
      permit.binding.allocationDecisionId,
    ],
  ];
  for (const [name, actual, bound] of bindings) {
    if (actual !== bound) {
      throw new Error(`Permit ${name} binding mismatch`);
    }
  }
}

export async function consumeExecutionPermit(
  store: PermitStore,
  permitId: string,
  nonce: string,
): Promise<void> {
  const consumed = await store.consume(permitId, nonce);
  if (!consumed) {
    throw new Error('Permit replay or invalid nonce');
  }
}
