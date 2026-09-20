import { createHash } from 'node:crypto';
import type { ActionRequest } from '@jhadina/action-core';
import {
  issueExecutionPermit,
  type ExecutionAction,
  type ExecutionPermit,
} from './execution-permit.js';

/**
 * Action Core remains the authority owner. This record is a downstream proof
 * of the already-evaluated Action Core outcome; it does not evaluate policy.
 */
export type MoneyActionCoreAuthority = Readonly<{
  authorityId: string;
  actionRequestId: string;
  actionRequestFingerprint: string;
  userId: string;
  capability: string;
  decision: 'allow' | 'approval_required';
  approvalReceiptId?: string;
  policyVersion: string;
  policyHash: string;
  authorizedAt: string;
  expiresAt: string;
}>;

export type MoneyAuthorityBinding = Readonly<{
  authorityId: string;
  actionRequestId: string;
  actionRequestFingerprint: string;
  userId: string;
  capability: string;
  approvalReceiptId?: string;
  executionPermitId: string;
  actionFingerprint: string;
  policyVersion: string;
  policyHash: string;
}>;

type JsonLike =
  | null
  | boolean
  | number
  | string
  | readonly JsonLike[]
  | { readonly [key: string]: JsonLike | undefined };

function stableCanonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('MONEY_ACTION_CORE_REQUEST_NONFINITE_NUMBER');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableCanonicalize(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const entries = Object.keys(object)
      .sort()
      .filter((key) => object[key] !== undefined)
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableCanonicalize(object[key])}`,
      );
    return `{${entries.join(',')}}`;
  }
  throw new Error('MONEY_ACTION_CORE_REQUEST_UNSUPPORTED_VALUE');
}

export function fingerprintActionRequest<TAction>(
  request: ActionRequest<TAction>,
): string {
  const canonical: JsonLike = {
    id: request.id,
    userId: request.userId,
    type: request.type,
    action: request.action as JsonLike,
    requestedAt: request.requestedAt,
    approvalReceiptId: request.approvalReceiptId ?? null,
  };
  return createHash('sha256')
    .update(stableCanonicalize(canonical), 'utf8')
    .digest('hex');
}

function parseTimestamp(value: string, code: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(code);
  return parsed;
}

export function createMoneyActionCoreAuthority<TAction>(
  request: ActionRequest<TAction>,
  input: Readonly<{
    authorityId: string;
    decision: 'allow' | 'approval_required';
    policyVersion: string;
    policyHash: string;
    authorizedAt: string;
    expiresAt: string;
  }>,
): MoneyActionCoreAuthority {
  if (!request.id || !request.userId || !request.type) {
    throw new Error('MONEY_ACTION_CORE_REQUEST_INCOMPLETE');
  }
  if (!input.authorityId || !input.policyVersion || !input.policyHash) {
    throw new Error('MONEY_ACTION_CORE_AUTHORITY_INCOMPLETE');
  }
  if (
    input.decision === 'approval_required' &&
    !request.approvalReceiptId
  ) {
    throw new Error('MONEY_ACTION_CORE_APPROVAL_REQUIRED');
  }

  const requestedAt = parseTimestamp(
    request.requestedAt,
    'MONEY_ACTION_CORE_REQUEST_TIME_INVALID',
  );
  const authorizedAt = parseTimestamp(
    input.authorizedAt,
    'MONEY_ACTION_CORE_AUTHORIZED_TIME_INVALID',
  );
  const expiresAt = parseTimestamp(
    input.expiresAt,
    'MONEY_ACTION_CORE_AUTHORITY_EXPIRY_INVALID',
  );
  if (authorizedAt < requestedAt) {
    throw new Error('MONEY_ACTION_CORE_AUTHORIZED_BEFORE_REQUEST');
  }
  if (expiresAt <= authorizedAt) {
    throw new Error('MONEY_ACTION_CORE_AUTHORITY_EXPIRY_INVALID');
  }

  return Object.freeze({
    authorityId: input.authorityId,
    actionRequestId: request.id,
    actionRequestFingerprint: fingerprintActionRequest(request),
    userId: request.userId,
    capability: request.type,
    decision: input.decision,
    approvalReceiptId: request.approvalReceiptId,
    policyVersion: input.policyVersion,
    policyHash: input.policyHash,
    authorizedAt: input.authorizedAt,
    expiresAt: input.expiresAt,
  });
}

export function assertActionCoreAuthorityMatches<TAction>(
  request: ActionRequest<TAction>,
  authority: MoneyActionCoreAuthority,
): void {
  if (authority.actionRequestId !== request.id) {
    throw new Error('MONEY_ACTION_CORE_AUTHORITY_REQUEST_MISMATCH');
  }
  if (authority.userId !== request.userId) {
    throw new Error('MONEY_ACTION_CORE_AUTHORITY_USER_MISMATCH');
  }
  if (authority.capability !== request.type) {
    throw new Error('MONEY_ACTION_CORE_AUTHORITY_CAPABILITY_MISMATCH');
  }
  if (
    authority.actionRequestFingerprint !==
    fingerprintActionRequest(request)
  ) {
    throw new Error(
      'MONEY_ACTION_CORE_AUTHORITY_REQUEST_FINGERPRINT_MISMATCH',
    );
  }
  if (authority.approvalReceiptId !== request.approvalReceiptId) {
    throw new Error('MONEY_ACTION_CORE_AUTHORITY_APPROVAL_MISMATCH');
  }
  if (
    authority.decision === 'approval_required' &&
    !authority.approvalReceiptId
  ) {
    throw new Error('MONEY_ACTION_CORE_AUTHORITY_APPROVAL_REQUIRED');
  }
}

export function issueActionCoreBoundExecutionPermit(
  request: ActionRequest<unknown>,
  action: ExecutionAction,
  authority: MoneyActionCoreAuthority,
  input: Readonly<{
    expiresAt: string;
    opportunityId?: string;
    riskDecisionId?: string;
    allocationDecisionId?: string;
    now: string;
    permitId?: string;
    nonce?: string;
  }>,
): ExecutionPermit {
  assertActionCoreAuthorityMatches(request, authority);
  if (request.id !== action.actionId) {
    throw new Error('MONEY_ACTION_CORE_ACTION_ID_MISMATCH');
  }
  if (request.userId !== action.userId) {
    throw new Error('MONEY_ACTION_CORE_USER_MISMATCH');
  }
  if (request.type !== action.capability) {
    throw new Error('MONEY_ACTION_CORE_CAPABILITY_MISMATCH');
  }

  const now = parseTimestamp(
    input.now,
    'MONEY_ACTION_CORE_PERMIT_TIME_INVALID',
  );
  const authorizedAt = parseTimestamp(
    authority.authorizedAt,
    'MONEY_ACTION_CORE_AUTHORIZED_TIME_INVALID',
  );
  const authorityExpiresAt = parseTimestamp(
    authority.expiresAt,
    'MONEY_ACTION_CORE_AUTHORITY_EXPIRY_INVALID',
  );
  const permitExpiresAt = parseTimestamp(
    input.expiresAt,
    'MONEY_ACTION_CORE_PERMIT_EXPIRY_INVALID',
  );
  if (now < authorizedAt || now >= authorityExpiresAt) {
    throw new Error('MONEY_ACTION_CORE_AUTHORITY_NOT_ACTIVE');
  }
  if (permitExpiresAt > authorityExpiresAt) {
    throw new Error('MONEY_ACTION_CORE_PERMIT_OUTLIVES_AUTHORITY');
  }

  return issueExecutionPermit({
    action,
    actionRequestFingerprint: authority.actionRequestFingerprint,
    authorityId: authority.authorityId,
    policyVersion: authority.policyVersion,
    policyHash: authority.policyHash,
    approvalId: authority.approvalReceiptId,
    opportunityId: input.opportunityId,
    riskDecisionId: input.riskDecisionId,
    allocationDecisionId: input.allocationDecisionId,
    expiresAt: input.expiresAt,
    now: input.now,
    permitId: input.permitId,
    nonce: input.nonce,
  });
}

export function bindActionCoreAuthority(
  request: ActionRequest<unknown>,
  action: ExecutionAction,
  permit: ExecutionPermit,
): MoneyAuthorityBinding {
  if (!request.id || !request.userId || !request.type) {
    throw new Error('MONEY_ACTION_CORE_REQUEST_INCOMPLETE');
  }
  if (request.id !== action.actionId) {
    throw new Error('MONEY_ACTION_CORE_ACTION_ID_MISMATCH');
  }
  if (request.userId !== action.userId) {
    throw new Error('MONEY_ACTION_CORE_USER_MISMATCH');
  }
  if (request.type !== action.capability) {
    throw new Error('MONEY_ACTION_CORE_CAPABILITY_MISMATCH');
  }
  if (permit.binding.userId !== request.userId) {
    throw new Error('MONEY_ACTION_CORE_PERMIT_USER_MISMATCH');
  }
  if (permit.binding.capability !== request.type) {
    throw new Error('MONEY_ACTION_CORE_PERMIT_CAPABILITY_MISMATCH');
  }
  if (request.approvalReceiptId !== permit.binding.approvalId) {
    throw new Error('MONEY_ACTION_CORE_APPROVAL_MISMATCH');
  }

  const requestFingerprint = fingerprintActionRequest(request);
  if (
    permit.binding.actionRequestFingerprint !== requestFingerprint
  ) {
    throw new Error(
      'MONEY_ACTION_CORE_REQUEST_FINGERPRINT_MISMATCH',
    );
  }
  if (!permit.binding.authorityId) {
    throw new Error('MONEY_ACTION_CORE_PERMIT_AUTHORITY_MISSING');
  }

  return Object.freeze({
    authorityId: permit.binding.authorityId,
    actionRequestId: request.id,
    actionRequestFingerprint: requestFingerprint,
    userId: request.userId,
    capability: request.type,
    approvalReceiptId: request.approvalReceiptId,
    executionPermitId: permit.permitId,
    actionFingerprint: permit.binding.actionFingerprint,
    policyVersion: permit.binding.policyVersion,
    policyHash: permit.binding.policyHash,
  });
}
