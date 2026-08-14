import { StripeSandboxPaymentProvider, type StripeFetch } from "./stripe-sandbox-provider"
import { EnvironmentSandboxCredentialResolver, type SandboxCredentialResolver } from "./sandbox-credential"

/**
 * PL-6 (Jhadina OS Integration Phase 2): the real Stripe test-mode
 * credential-resolution boundary — the piece Money's own reference
 * proof never built either (governed-account-read.ts's own comment:
 * "PlaidReadOnlyAdapter ... swapping this reference adapter for it is
 * a one-line change"). This file is that one-line change, made real:
 * EnvironmentSandboxCredentialResolver(real process.env) ->
 * assertStripeSandboxKey (inside .resolve(), fail-closed) ->
 * StripeSandboxPaymentProvider constructed with the resolved secret
 * and NO injected fake transport — this is the first place in the
 * whole Commerce proof where the default fetchImpl (real, global
 * fetch) is actually reachable, not overridden.
 *
 * There is still no live call proven end to end: no real
 * sk_test_... value exists anywhere in this environment (checked
 * before this file was written — no JHADINA_SECRET_STRIPE_SANDBOX in
 * process.env, .env.example, or any committed config). That is a
 * deliberate scope boundary, not an oversight — this milestone is
 * "complete the credential-resolution plumbing," not "prove a live
 * call," per explicit instruction. Once a real key is set as
 * JHADINA_SECRET_STRIPE_SANDBOX, createStripeSandboxProductionProvider()
 * with no overrides is the real, live-capable provider — nothing else
 * changes.
 *
 * fetchImpl is exposed here purely as a test-only escape hatch
 * (mirroring every prior proof's injectable-transport pattern) — it
 * must never be set by real composition code. Its own tests spy on
 * the actual global fetch instead of using this override, specifically
 * to prove the *default* path — the one production composition would
 * take — reaches the real transport.
 */

export const STRIPE_SANDBOX_CREDENTIAL_REF = "commerce/stripe/sandbox"

export type CreateStripeSandboxProductionProviderOptions = {
  credentialResolver?: SandboxCredentialResolver
  credentialRef?: string
  /** Test-only. Never set this in real composition code — see file header. */
  fetchImpl?: StripeFetch
}

export async function createStripeSandboxProductionProvider(
  options: CreateStripeSandboxProductionProviderOptions = {},
): Promise<StripeSandboxPaymentProvider> {
  const credentialResolver = options.credentialResolver ?? new EnvironmentSandboxCredentialResolver()
  const credentialRef = options.credentialRef ?? STRIPE_SANDBOX_CREDENTIAL_REF

  // Credential resolution (and its fail-closed sk_test_ assertion)
  // happens before any provider exists — mirroring money-core's
  // ProviderAdapterFactory, which resolves and validates a credential
  // before ever constructing an adapter.
  const credential = await credentialResolver.resolve(credentialRef)

  return new StripeSandboxPaymentProvider({
    secret: credential.secret,
    fetchImpl: options.fetchImpl,
  })
}
