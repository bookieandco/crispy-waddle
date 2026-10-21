import type { SocialAccount } from "@jhadina/social-core"

type ReadinessState = "unconfigured" | "configured_unverified" | "registered_unverified"

export interface SocialConnectionReadiness {
  provider: "hootsuite" | "ayrshare"
  state: ReadinessState
  registeredAccountCount: number
  verifiedLiveDelivery: false
  supportedRuntimeMethods: readonly ["profiles.discover", "publish", "deliveries.read", "delete"]
  postingCommissioned: false
}

const METHODS = ["profiles.discover", "publish", "deliveries.read", "delete"] as const

/**
 * Server-only metadata. A vendor's advertised API capabilities or a configured
 * token are NOT evidence that the owner authorized a particular social profile.
 */
export function buildSocialConnectionReadiness(
  userId: string,
  accounts: readonly SocialAccount[],
  env: Readonly<Record<string, string | undefined>>,
): readonly SocialConnectionReadiness[] {
  const providers = ["hootsuite", "ayrshare"] as const
  return providers.map((provider): SocialConnectionReadiness => {
    const ownerKey = provider === "hootsuite" ? "HOOTSUITE_OWNER_USER_ID" : "AYRSHARE_OWNER_USER_ID"
    const credentialKey = provider === "hootsuite" ? "HOOTSUITE_ACCESS_TOKEN" : "AYRSHARE_API_KEY"
    const configured = env[ownerKey] === userId && !!env[credentialKey]?.trim() &&
      (provider !== "ayrshare" || !!env.AYRSHARE_PROFILE_BINDINGS_JSON?.trim())
    const registeredAccountCount = accounts.filter((a) =>
      a.userId === userId && a.provider === provider && a.status === "connected",
    ).length
    return {
      provider,
      state: !configured ? "unconfigured" :
        registeredAccountCount ? "registered_unverified" : "configured_unverified",
      registeredAccountCount, verifiedLiveDelivery: false,
      supportedRuntimeMethods: METHODS,
      postingCommissioned: false,
    }
  })
}
