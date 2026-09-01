import type { CredentialBroker, CredentialRequest, CredentialTrust, EgressPolicy } from '@jhadina/security-core';
import type { CredentialResolver, ResolvedCredential } from './credential-resolver.js';

export type CredentialEgressBinding = {
  policy: EgressPolicy;
  destination: string;
  dataClass?: 'public' | 'internal' | 'pii' | 'secret';
};

/**
 * Releases a credential only after the credential request is bound to an
 * allowlisted egress destination. The credential itself is never logged or
 * included in the egress decision payload.
 */
export class BrokerCredentialResolver implements CredentialResolver {
  constructor(
    private readonly broker: CredentialBroker,
    private readonly request: CredentialRequest,
    private readonly trust: CredentialTrust = 'trusted-compute',
    private readonly egress?: CredentialEgressBinding,
  ) {}

  private async authorizeEgress(): Promise<void> {
    if (!this.egress) return;
    const decision = await this.egress.policy.authorize({
      requestId: this.request.requestId,
      actorId: this.request.actorId,
      capability: this.request.capability,
      destination: this.egress.destination,
      method: 'POST',
      dataClass: this.egress.dataClass ?? 'internal',
      issuedAt: this.request.issuedAt,
      expiresAt: this.request.expiresAt,
    });
    if (decision.decision !== 'allow') {
      throw new Error(`EGRESS_DENIED:${decision.reason}`);
    }
  }

  async resolve(credentialRef: string): Promise<ResolvedCredential> {
    if (credentialRef !== this.request.credentialRef) throw new Error('CREDENTIAL_REF_SCOPE_MISMATCH');
    await this.authorizeEgress();
    const grant = await this.broker.issue({ ...this.request, workerTrust: this.trust });
    await this.authorizeEgress();
    const material = await this.broker.use(grant, {
      actorId: this.request.actorId,
      workerId: this.request.workerId,
      capability: this.request.capability,
      provider: this.request.provider,
      credentialRef: this.request.credentialRef,
      purpose: this.request.purpose,
      resourceId: this.request.resourceId,
    });
    return { secret: material.secret, expiresAt: material.expiresAt === undefined ? undefined : new Date(material.expiresAt).toISOString() };
  }
}
