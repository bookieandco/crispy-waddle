/**
 * Commerce sandbox-payment milestone: credential resolution, mirroring
 * money-core's already-proven CredentialResolver/EnvironmentCredentialResolver
 * pattern (namespaced ref -> JHADINA_SECRET_* env var) rather than
 * inventing a new mechanism. Implemented locally instead of imported
 * from @jhadina/money-core to avoid a cross-domain package dependency
 * for a generic utility — SP-2's own reference/bridge adapters never
 * reached into money-core either.
 *
 * The one addition beyond money-core's pattern: a hard, fail-closed
 * assertion that the resolved secret is a Stripe *test-mode* key.
 * Stripe has no separate sandbox base URL — test vs. live mode is
 * determined entirely by which key you authenticate with — so this
 * assertion is the actual safety boundary "no production credentials"
 * depends on, not the endpoint choice.
 */

export type ResolvedSandboxCredential = {
  secret: string;
};

export interface SandboxCredentialResolver {
  resolve(credentialRef: string): Promise<ResolvedSandboxCredential>;
}

/** Development-only resolver. A production credential path would replace this, not the interface. */
export class EnvironmentSandboxCredentialResolver implements SandboxCredentialResolver {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async resolve(credentialRef: string): Promise<ResolvedSandboxCredential> {
    const key = sandboxCredentialRefToEnvKey(credentialRef);
    const secret = this.env[key];
    if (!secret) throw new Error(`CREDENTIAL_NOT_CONFIGURED:${credentialRef}`);
    assertStripeSandboxKey(secret, credentialRef);
    return { secret };
  }
}

export function sandboxCredentialRefToEnvKey(credentialRef: string): string {
  if (!/^commerce\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i.test(credentialRef)) {
    throw new Error(`INVALID_CREDENTIAL_REF:${credentialRef}`);
  }
  return `JHADINA_SECRET_${credentialRef
    .replace(/^commerce\//i, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .toUpperCase()}`;
}

/** Never let a live key reach the sandbox provider, no matter where the secret came from. */
export function assertStripeSandboxKey(secret: string, credentialRef: string): void {
  if (!secret.startsWith("sk_test_")) {
    throw new Error(`SANDBOX_CREDENTIAL_MUST_BE_TEST_MODE:${credentialRef}`);
  }
}
