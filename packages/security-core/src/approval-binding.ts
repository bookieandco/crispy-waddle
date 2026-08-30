import { createHash, randomUUID } from 'node:crypto';

export type ApprovalBinding = {
  approvalId: string;
  principalId: string;
  actorId: string;
  deviceId: string;
  sessionId: string;
  capability: string;
  domain: string;
  resourceId?: string;
  payloadHash: string;
  issuedAt: number;
  expiresAt: number;
  singleUse: true;
};

export function canonicalApprovalInput(input: Omit<ApprovalBinding, 'approvalId' | 'issuedAt' | 'singleUse'>): string {
  return JSON.stringify({
    actorId: input.actorId,
    capability: input.capability,
    deviceId: input.deviceId,
    domain: input.domain,
    expiresAt: input.expiresAt,
    payloadHash: input.payloadHash,
    principalId: input.principalId,
    resourceId: input.resourceId ?? null,
    sessionId: input.sessionId,
  });
}

export function approvalBindingHash(binding: Omit<ApprovalBinding, 'approvalId' | 'issuedAt' | 'singleUse'>): string {
  return createHash('sha256').update(canonicalApprovalInput(binding)).digest('hex');
}

export function createApprovalBinding(input: {
  principalId: string;
  actorId: string;
  deviceId: string;
  sessionId: string;
  capability: string;
  domain: string;
  resourceId?: string;
  payloadHash: string;
  ttlMs?: number;
}): ApprovalBinding {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + Math.min(input.ttlMs ?? 60_000, 300_000);
  return {
    ...input,
    approvalId: randomUUID(),
    issuedAt,
    expiresAt,
    singleUse: true,
  };
}

export function validateApprovalBinding(
  approval: ApprovalBinding,
  request: {
    principalId: string;
    actorId: string;
    deviceId: string;
    sessionId: string;
    capability: string;
    domain: string;
    resourceId?: string;
    payloadHash: string;
  },
  now = Date.now(),
): boolean {
  if (approval.expiresAt <= now || approval.issuedAt > now || !approval.singleUse) return false;
  return approvalBindingHash(approval) === approvalBindingHash({
    ...request,
    expiresAt: approval.expiresAt,
  });
}
