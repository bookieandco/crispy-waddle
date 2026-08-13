import {
  ProviderAdapterFactory,
  MoneyProviderRegistry,
  EnvironmentCredentialResolver,
  createGovernedProviderAccountReadExecutor,
  credentialRefToEnvKey,
  type ProviderConfig,
  type ProviderAdapterBuilder,
  type MoneyAccount,
} from "@jhadina/money-core"
import type { ActionIdentityVerifier, AuditRpcClient } from "@jhadina/action-core"
import {
  createReferenceBankAdapter,
  type ReferenceBankFailureMode,
  type ReferenceBankFixture,
  type RecordedReferenceRequest,
} from "./reference-adapters"

/**
 * Spine Proof #3 (Money/Plaid) — composition root.
 *
 * Money UI/consumer -> this module -> money-core's own governed
 * production composition (`createGovernedProviderAccountReadExecutor`
 * -> `createProductionMoneyAccountReadExecutor` -> `SecurityCoreActionPolicy`
 * -> `MoneyAccountReadHandler` -> `assertCapability`) -> a reference
 * read-only provider built through the real `ProviderAdapterFactory` +
 * `EnvironmentCredentialResolver` credential path.
 *
 * Nothing here reimplements money-core's governance — it wires the
 * already-landed pieces together with reference/in-memory dependencies
 * so the composed lifecycle can be exercised without a live Plaid
 * credential or network call. `PlaidReadOnlyAdapter` is untouched and
 * remains the eventual production boundary; swapping this reference
 * adapter for it is a one-line change to `builders` below.
 */

export const REFERENCE_MONEY_PROVIDER = "reference-bank"
const REFERENCE_SECRET = "ref-secret-do-not-log-9f2c"

export type ReferenceMoneyAccountReadSetup = {
  identityVerifier: ActionIdentityVerifier
  supabase: AuditRpcClient
  assertUserWorkspace?: (userId: string) => Promise<void>
  provider?: string
  fixture?: ReferenceBankFixture
  failureMode?: ReferenceBankFailureMode
  recordedRequests?: RecordedReferenceRequest[]
  /** Simulate the provider being disabled/unconfigured at the health-gate layer. */
  enabled?: boolean
  /** Simulate the capability allow-list on the provider config not including money.account.read. */
  omitCapabilityFromConfig?: boolean
  /** Simulate a missing/unresolved credential (provider failure before any adapter call). */
  omitCredential?: boolean
}

export type ReferenceMoneyAccountReadExecutor = {
  execute(request: { id: string; userId: string; type: string; requestedAt: string; action: { capability: "money.account.read"; provider: string } }): Promise<MoneyAccount[]>
}

export async function createReferenceMoneyAccountReadExecutor(
  setup: ReferenceMoneyAccountReadSetup,
): Promise<ReferenceMoneyAccountReadExecutor> {
  const provider = setup.provider ?? REFERENCE_MONEY_PROVIDER
  const credentialRef = `money/${provider}/read-only`
  const envKey = credentialRefToEnvKey(credentialRef)

  // EnvironmentCredentialResolver takes an injectable env map instead of
  // reading real process.env — this proof never touches process.env at
  // all, let alone a PLAID_* key, real or otherwise.
  const referenceEnv = (setup.omitCredential ? {} : { [envKey]: REFERENCE_SECRET }) as NodeJS.ProcessEnv
  const credentialResolver = new EnvironmentCredentialResolver(referenceEnv)

  const config: ProviderConfig = {
    enabled: setup.enabled ?? true,
    credentialRef,
    capabilities: setup.omitCapabilityFromConfig ? [] : ["money.account.read"],
  }

  const builder: ProviderAdapterBuilder = ({ secret }) =>
    createReferenceBankAdapter({
      provider,
      secret,
      fixture: setup.fixture,
      failureMode: setup.failureMode,
      recordedRequests: setup.recordedRequests,
    })

  const factory = new ProviderAdapterFactory({
    credentialResolver,
    configs: { [provider]: config },
    builders: { [provider]: builder },
  })

  // Credential resolution + adapter construction happens once, up front —
  // exactly like the production composition would do it at process/route
  // start-up, not per request.
  const adapter = await factory.create(provider)
  const registry = new MoneyProviderRegistry()
  registry.register(adapter)

  return createGovernedProviderAccountReadExecutor({
    identityVerifier: setup.identityVerifier,
    supabase: setup.supabase,
    providers: registry,
    providerConfig: { [provider]: config },
    assertUserWorkspace: setup.assertUserWorkspace,
  })
}

export function referenceSecretFixture(): string {
  return REFERENCE_SECRET
}
