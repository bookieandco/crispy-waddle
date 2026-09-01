import type { CredentialBroker } from "@jhadina/security-core"
import type { CredentialResolver, ResolvedCredential } from "@jhadina/money-core"

export type BrokerCredentialResolverOptions = {
  broker: CredentialBroker
  actorId: string
  workerId: string
  domain: string
  capability: string
  resourceId?: string
}

/**
 * Provider-facing resolver backed by CredentialBroker.
 *
 * The provider factory sees only the existing CredentialResolver contract.
 * Each resolve creates a short-lived lease and consumes it immediately, so
 * provider adapters never retain a lease and no secret is present in action
 * objects, audit records, or worker messages.
 */
export class BrokerCredentialResolver implements CredentialResolver {
  constructor(private readonly options: BrokerCredentialResolverOptions) {}

  async resolve(credentialRef: string): Promise<ResolvedCredential> {
    const lease = await this.options.broker.issue({
      actorId: this.options.actorId,
      workerId: this.options.workerId,
      domain: this.options.domain,
      capability: this.options.capability,
      credentialRef,
      resourceId: this.options.resourceId,
    })
    const secret = await this.options.broker.consume(lease, {
      actorId: this.options.actorId,
      workerId: this.options.workerId,
      domain: this.options.domain,
      capability: this.options.capability,
      credentialRef,
      resourceId: this.options.resourceId,
    })
    return { secret, expiresAt: new Date(lease.expiresAt).toISOString() }
  }
}

/** Server-side secret source used only behind CredentialBroker. */
export function createServerEnvironmentSecretStore(env: NodeJS.ProcessEnv = process.env) {
  return {
    async resolve(credentialRef: string): Promise<string> {
      const normalizedRef = credentialRef.replace(/^money\//i, "")
      const key = `JHADINA_SECRET_${normalizedRef.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}`
      const secret = env[key]
      if (!secret) throw new Error(`CREDENTIAL_NOT_CONFIGURED:${credentialRef}`)
      return secret
    },
  }
}
