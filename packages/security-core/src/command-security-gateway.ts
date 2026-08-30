import { createHash, randomUUID } from 'node:crypto';
import type { SecurityPrincipal } from './security-principal.js';
import { bindPrincipalToRequest } from './security-principal.js';
import { isCapabilityPermitted, type SecurityPosture } from './security-posture.js';
import { JHADINA_BASE_SECURITY_POLICY, type SecurityDecision } from './index.js';

export type CommandSecurityRequest = {
  requestId: string;
  actorId: string;
  domain: string;
  capability: string;
  resourceId?: string;
  payload: unknown;
  nonce: string;
  expiresAt: number;
  principal: SecurityPrincipal;
};

export type CommandSecurityResult =
  | { decision: 'allow'; payloadHash: string }
  | { decision: 'approval_required'; payloadHash: string }
  | { decision: 'deny'; reason: string; payloadHash: string };

function stablePayload(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stablePayload).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => `${JSON.stringify(key)}:${stablePayload(val)}`).join(',')}}`;
}

function payloadHash(payload: unknown): string {
  return createHash('sha256').update(stablePayload(payload)).digest('hex');
}

export class CommandSecurityGateway {
  constructor(
    private readonly posture: SecurityPosture = 'normal',
  ) {}

  authorize(request: CommandSecurityRequest): CommandSecurityResult {
    const hash = payloadHash(request.payload);
    const now = Date.now();

    if (!request.requestId || !request.actorId || !request.domain || !request.capability) {
      return { decision: 'deny', reason: 'invalid_security_request', payloadHash: hash };
    }
    if (!bindPrincipalToRequest(request.principal, {
      actorId: request.actorId,
      principalId: request.principal.principalId,
      deviceId: request.principal.deviceId ?? '',
      sessionId: request.principal.sessionId ?? '',
      expiresAt: request.expiresAt,
    }, now)) {
      return { decision: 'deny', reason: 'principal_binding_failed', payloadHash: hash };
    }
    if (request.expiresAt <= now) {
      return { decision: 'deny', reason: 'request_expired', payloadHash: hash };
    }
    if (!isCapabilityPermitted(this.posture, request.capability)) {
      return { decision: 'deny', reason: `blocked_by_security_posture:${this.posture}`, payloadHash: hash };
    }
    if (JHADINA_BASE_SECURITY_POLICY.deniedCapabilities?.includes(request.capability)) {
      return { decision: 'deny', reason: 'capability_denied', payloadHash: hash };
    }
    if (!JHADINA_BASE_SECURITY_POLICY.allowedCapabilities.includes(request.capability)) {
      return { decision: 'deny', reason: 'capability_not_allowlisted', payloadHash: hash };
    }
    if (JHADINA_BASE_SECURITY_POLICY.approvalCapabilities.includes(request.capability)) {
      return { decision: 'approval_required', payloadHash: hash };
    }
    return { decision: 'allow', payloadHash: hash };
  }

  static newRequestId(): string {
    return randomUUID();
  }
}

export type { SecurityDecision };
