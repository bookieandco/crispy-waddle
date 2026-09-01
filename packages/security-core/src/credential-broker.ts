import type { CredentialLeaseStore, CredentialLeaseUseRequest } from './credential-lease-store.js';
import type { KillSwitchDecision, SecurityKillSwitch } from './security-kill-switch.js';
import type { SecurityPosture } from './security-posture.js';
import type { AuthoritativePolicyDecision } from './authoritative-policy-decision.js';
import { verifyAuthoritativePolicyDecision } from './authoritative-policy-decision.js';

export type CredentialTrust = 'untrusted' | 'quarantined' | 'trusted-compute';
export type CredentialRequest = {
  requestId: string; actorId: string; workerId?: string; workerTrust?: CredentialTrust;
  capability: string; provider: string; credentialRef: string; purpose: string; resourceId?: string;
  issuedAt: number; expiresAt: number; nonce: string;
  egressDestination?: string; egressPolicyVersion?: string; egressDecisionReason?: string;
};
export type CredentialGrant = {
  leaseId: string; requestId: string; actorId: string; workerId?: string; capability: string; provider: string; credentialRef: string;
  purpose: string; resourceId?: string; issuedAt: number; expiresAt: number; maxUses: number;
  policyDecisionId: string; policyVersion: string;
  egressDestination?: string; egressPolicyVersion?: string; egressDecisionReason?: string;
};
export type CredentialMaterial = { secret: string; expiresAt?: number };
export interface CredentialStore { resolve(credentialRef: string): Promise<CredentialMaterial | null> }
export type CredentialPolicy = { maxTtlMs: number; providerCapabilities: Readonly<Record<string, readonly string[]>>; allowedCredentialRefs: readonly string[]; maxUses: number };
export class CredentialBrokerError extends Error { constructor(public readonly code: string) { super(code); this.name = 'CredentialBrokerError'; } }

export type CredentialSecurityGate = {
  killSwitch: SecurityKillSwitch;
  posture: SecurityPosture | (() => SecurityPosture);
  policyDecision: AuthoritativePolicyDecision | (() => AuthoritativePolicyDecision | Promise<AuthoritativePolicyDecision>);
};

type SecurityAuthorization = { killSwitch: KillSwitchDecision; policy: AuthoritativePolicyDecision };

export class CredentialBroker {
  constructor(
    private readonly store: CredentialStore,
    private readonly policy: CredentialPolicy,
    private readonly now: () => number = Date.now,
    private readonly idFactory: () => string = () => crypto.randomUUID(),
    private readonly leaseStore?: CredentialLeaseStore,
    private readonly securityGate?: CredentialSecurityGate,
  ) {}

  private posture(): SecurityPosture {
    return typeof this.securityGate?.posture === 'function' ? this.securityGate.posture() : (this.securityGate?.posture ?? 'normal');
  }

  private async policyDecision(): Promise<AuthoritativePolicyDecision> {
    if (!this.securityGate) throw new CredentialBrokerError('POLICY_DECISION_REQUIRED');
    const value = this.securityGate.policyDecision;
    return typeof value === 'function' ? await value() : value;
  }

  private async authorizeSecurity(request: CredentialRequest): Promise<SecurityAuthorization | null> {
    if (!this.securityGate) return null;
    let decision: KillSwitchDecision;
    try { decision = await this.securityGate.killSwitch.decide(this.posture(), request.capability); }
    catch { throw new CredentialBrokerError('KILL_SWITCH_STATE_UNAVAILABLE'); }
    if (!decision.allowed) throw new CredentialBrokerError(decision.reason === 'kill_switch_enabled' ? 'KILL_SWITCH_ENABLED' : 'SECURITY_POSTURE_DENIED');
    let policy: AuthoritativePolicyDecision;
    try { policy = await this.policyDecision(); } catch { throw new CredentialBrokerError('POLICY_DECISION_UNAVAILABLE'); }
    if (!verifyAuthoritativePolicyDecision(policy, {
      requestId: request.requestId, actorId: request.actorId, domain: request.provider,
      capability: request.capability, resourceId: request.resourceId,
    }, this.now())) throw new CredentialBrokerError('POLICY_DECISION_BINDING_INVALID');
    if (policy.decision !== 'allow') throw new CredentialBrokerError(policy.decision === 'approval_required' ? 'POLICY_APPROVAL_REQUIRED' : 'POLICY_DENIED');
    return { killSwitch: decision, policy };
  }

  async issue(request: CredentialRequest): Promise<CredentialGrant> {
    const now = this.now();
    if (!request.requestId || !request.actorId || !request.nonce) throw new CredentialBrokerError('INVALID_IDENTITY');
    if (!request.purpose.trim()) throw new CredentialBrokerError('PURPOSE_REQUIRED');
    if (request.expiresAt <= now) throw new CredentialBrokerError('REQUEST_EXPIRED');
    if (request.expiresAt - now > this.policy.maxTtlMs) throw new CredentialBrokerError('TTL_EXCEEDED');
    if (!this.policy.allowedCredentialRefs.includes(request.credentialRef)) throw new CredentialBrokerError('CREDENTIAL_REF_DENIED');
    if (!(this.policy.providerCapabilities[request.provider] ?? []).includes(request.capability)) throw new CredentialBrokerError('CAPABILITY_PROVIDER_MISMATCH');
    if (request.workerTrust !== undefined && request.workerTrust !== 'trusted-compute') throw new CredentialBrokerError('WORKER_NOT_TRUSTED');
    if (request.workerId === undefined && request.workerTrust !== undefined) throw new CredentialBrokerError('WORKER_BINDING_REQUIRED');
    if (request.egressDestination !== undefined && !request.egressPolicyVersion) throw new CredentialBrokerError('EGRESS_POLICY_BINDING_REQUIRED');
    const authorization = await this.authorizeSecurity(request);
    if (!authorization) throw new CredentialBrokerError('POLICY_DECISION_REQUIRED');
    const material = await this.store.resolve(request.credentialRef);
    if (!material?.secret) throw new CredentialBrokerError('CREDENTIAL_NOT_AVAILABLE');
    if (material.expiresAt !== undefined && material.expiresAt <= now) throw new CredentialBrokerError('CREDENTIAL_EXPIRED');
    const grant: CredentialGrant = {
      leaseId: this.idFactory(), requestId: request.requestId, actorId: request.actorId, workerId: request.workerId, capability: request.capability,
      provider: request.provider, credentialRef: request.credentialRef, purpose: request.purpose, resourceId: request.resourceId,
      issuedAt: now, expiresAt: Math.min(request.expiresAt, now + this.policy.maxTtlMs, material.expiresAt ?? Number.MAX_SAFE_INTEGER),
      maxUses: this.policy.maxUses, policyDecisionId: authorization.policy.decisionId, policyVersion: authorization.policy.policyVersion,
      egressDestination: request.egressDestination, egressPolicyVersion: request.egressPolicyVersion, egressDecisionReason: request.egressDecisionReason,
    };
    if (grant.expiresAt <= now) throw new CredentialBrokerError('CREDENTIAL_EXPIRED');
    if (this.leaseStore) await this.leaseStore.create(grant);
    return grant;
  }

  async use(grant: CredentialGrant, request: CredentialLeaseUseRequest): Promise<CredentialMaterial> {
    const now = this.now();
    if (grant.expiresAt <= now) throw new CredentialBrokerError('GRANT_EXPIRED');
    if (grant.requestId !== request.requestId) throw new CredentialBrokerError('REQUEST_MISMATCH');
    if (grant.actorId !== request.actorId) throw new CredentialBrokerError('ACTOR_MISMATCH');
    if (grant.workerId !== request.workerId) throw new CredentialBrokerError('WORKER_MISMATCH');
    if (grant.capability !== request.capability || grant.provider !== request.provider) throw new CredentialBrokerError('GRANT_SCOPE_MISMATCH');
    if (grant.credentialRef !== request.credentialRef) throw new CredentialBrokerError('CREDENTIAL_REF_MISMATCH');
    if (grant.purpose !== request.purpose) throw new CredentialBrokerError('PURPOSE_MISMATCH');
    if (grant.resourceId !== request.resourceId) throw new CredentialBrokerError('RESOURCE_MISMATCH');
    if (grant.egressDestination !== request.egressDestination || grant.egressPolicyVersion !== request.egressPolicyVersion || grant.egressDecisionReason !== request.egressDecisionReason) throw new CredentialBrokerError('EGRESS_BINDING_MISMATCH');
    const authorization = await this.authorizeSecurity({ ...request, requestId: grant.requestId, issuedAt: grant.issuedAt, expiresAt: grant.expiresAt, nonce: grant.requestId });
    if (!authorization) throw new CredentialBrokerError('POLICY_DECISION_REQUIRED');
    if (grant.policyDecisionId !== authorization.policy.decisionId || grant.policyVersion !== authorization.policy.policyVersion) throw new CredentialBrokerError('POLICY_DECISION_PROVENANCE_MISMATCH');
    if (!this.leaseStore) throw new CredentialBrokerError('DURABLE_LEASE_STORE_REQUIRED');
    if (!(await this.leaseStore.consume(grant.leaseId, request, now, grant.policyDecisionId, grant.policyVersion))) throw new CredentialBrokerError('LEASE_EXHAUSTED');
    const material = await this.store.resolve(grant.credentialRef);
    if (!material?.secret) throw new CredentialBrokerError('CREDENTIAL_NOT_AVAILABLE');
    if (material.expiresAt !== undefined && material.expiresAt <= now) throw new CredentialBrokerError('CREDENTIAL_EXPIRED');
    return { secret: material.secret, expiresAt: material.expiresAt };
  }
}

export class InMemoryCredentialStore implements CredentialStore {
  constructor(private readonly values: Readonly<Record<string, CredentialMaterial>>) {}
  async resolve(credentialRef: string): Promise<CredentialMaterial | null> { return this.values[credentialRef] ?? null; }
}
export function credentialGrantSafeAudit(grant: CredentialGrant): Omit<CredentialGrant, 'credentialRef'> & { credentialRef: '[REDACTED]' } { const { credentialRef: _credentialRef, ...safe } = grant; return { ...safe, credentialRef: '[REDACTED]' }; }
