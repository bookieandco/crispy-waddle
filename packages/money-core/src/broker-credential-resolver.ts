import type { CredentialBroker, CredentialRequest, CredentialTrust, EgressPolicy } from '@jhadina/security-core';
import type { CredentialResolver, ResolvedCredential } from './credential-resolver.js';

export type CredentialEgressBinding = { policy: EgressPolicy; destination: string; dataClass?: 'public' | 'internal' | 'pii' | 'secret' };

export class BrokerCredentialResolver implements CredentialResolver {
  constructor(private readonly broker: CredentialBroker, private readonly request: CredentialRequest, private readonly trust: CredentialTrust = 'trusted-compute', private readonly egress?: CredentialEgressBinding) {}

  private async authorizeEgress(): Promise<{ destination: string; policyVersion: string; reason: string }> {
    if (!this.egress) {
      if (this.request.egressDestination && this.request.egressPolicyVersion && this.request.egressDecisionReason) return { destination: this.request.egressDestination, policyVersion: this.request.egressPolicyVersion, reason: this.request.egressDecisionReason };
      throw new Error('EGRESS_BINDING_REQUIRED');
    }
    const decision = await this.egress.policy.authorize({ requestId: this.request.requestId, actorId: this.request.actorId, capability: this.request.capability, destination: this.egress.destination, method: 'POST', dataClass: this.egress.dataClass ?? 'internal', issuedAt: this.request.issuedAt, expiresAt: this.request.expiresAt });
    if (decision.decision !== 'allow' || !decision.normalizedDestination) throw new Error(`EGRESS_DENIED:${decision.reason}`);
    return { destination: decision.normalizedDestination, policyVersion: decision.policyVersion, reason: decision.reason };
  }

  async resolve(credentialRef: string): Promise<ResolvedCredential> {
    if (credentialRef !== this.request.credentialRef) throw new Error('CREDENTIAL_REF_SCOPE_MISMATCH');
    const egress = await this.authorizeEgress();
    const boundRequest: CredentialRequest = { ...this.request, workerTrust: this.trust, egressDestination: egress.destination, egressPolicyVersion: egress.policyVersion, egressDecisionReason: egress.reason };
    const grant = await this.broker.issue(boundRequest);
    const rechecked = await this.authorizeEgress();
    if (rechecked.destination !== grant.egressDestination || rechecked.policyVersion !== grant.egressPolicyVersion || rechecked.reason !== grant.egressDecisionReason) throw new Error('EGRESS_BINDING_CHANGED');
    const material = await this.broker.use(grant, {
      requestId: boundRequest.requestId, actorId: boundRequest.actorId, workerId: boundRequest.workerId, capability: boundRequest.capability,
      provider: boundRequest.provider, credentialRef: boundRequest.credentialRef, purpose: boundRequest.purpose,
      resourceId: boundRequest.resourceId, egressDestination: grant.egressDestination,
      egressPolicyVersion: grant.egressPolicyVersion, egressDecisionReason: grant.egressDecisionReason,
    });
    return { secret: material.secret, expiresAt: material.expiresAt === undefined ? undefined : new Date(material.expiresAt).toISOString() };
  }
}
