import type { CredentialBroker, CredentialRequest, CredentialTrust } from '@jhadina/security-core';
import type { CredentialResolver, ResolvedCredential } from './credential-resolver.js';

export class BrokerCredentialResolver implements CredentialResolver {
  constructor(private readonly broker: CredentialBroker, private readonly request: CredentialRequest, private readonly trust: CredentialTrust = 'trusted-compute') {}

  async resolve(credentialRef: string): Promise<ResolvedCredential> {
    if (credentialRef !== this.request.credentialRef) throw new Error('CREDENTIAL_REF_SCOPE_MISMATCH');
    const grant = await this.broker.issue({ ...this.request, workerTrust: this.trust });
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
