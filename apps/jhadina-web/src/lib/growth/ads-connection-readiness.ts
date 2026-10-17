/**
 * Credential-presence inventory only. This is NOT proof of OAuth scope,
 * owned ad accounts, a working production callback, or permission to spend.
 * Never add tokens, refresh tokens, account IDs, or advertiser PII here.
 */
export interface AdsConnectionReadiness {
  readOnly: true
  launchAuthorized: false
  meta: {
    transport: "markifact"
    pausedCampaignAdapterImplemented: true
    runtimeTokenPresent: boolean
    runtimeProviderCapabilityVerified: false
    adAccountBindingVerified: false
    instagramBindingVerified: false
    execution: "NOT_COMMISSIONED"
  }
  reddit: {
    targetingAndDiagnosticsImplemented: true
    adsExecutionAdapterImplemented: false
    runtimeOAuthVerified: false
    execution: "NOT_COMMISSIONED"
  }
  etsy: {
    marketplaceReadAdapterImplemented: true
    marketplaceApiKeyPresent: boolean
    nativeAdsExecutionAdapterImplemented: false
    execution: "RESEARCH_ONLY" | "NOT_COMMISSIONED"
  }
  artsy: {
    integrationImplemented: false
    execution: "NOT_COMMISSIONED"
  }
  spendGuard: {
    dailyCeilingConfigured: boolean
    lifetimeCeilingConfigured: boolean
    currencyConfigured: boolean
    configured: boolean
  }
}

function positiveInteger(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value.trim())) return undefined
  const number = Number(value.trim())
  return Number.isSafeInteger(number) && number > 0 ? number : undefined
}

export function buildAdsConnectionReadiness(
  env: Readonly<Record<string, string | undefined>>,
): AdsConnectionReadiness {
  const daily = positiveInteger(env.GROWTH_AD_MAX_DAILY_BUDGET_MINOR)
  const lifetime = positiveInteger(env.GROWTH_AD_MAX_LIFETIME_BUDGET_MINOR)
  const currency = (env.GROWTH_AD_BUDGET_CURRENCY ?? "USD").trim().toUpperCase()
  const validCurrency = /^[A-Z]{3}$/.test(currency)
  return {
    readOnly: true,
    launchAuthorized: false,
    meta: {
      transport: "markifact",
      pausedCampaignAdapterImplemented: true,
      runtimeTokenPresent: Boolean(env.MARKIFACT_MCP_ACCESS_TOKEN?.trim()),
      runtimeProviderCapabilityVerified: false,
      adAccountBindingVerified: false,
      instagramBindingVerified: false,
      execution: "NOT_COMMISSIONED",
    },
    reddit: {
      targetingAndDiagnosticsImplemented: true,
      adsExecutionAdapterImplemented: false,
      runtimeOAuthVerified: false,
      execution: "NOT_COMMISSIONED",
    },
    etsy: {
      marketplaceReadAdapterImplemented: true,
      marketplaceApiKeyPresent: Boolean(env.ETSY_API_KEY?.trim()),
      nativeAdsExecutionAdapterImplemented: false,
      execution: env.ETSY_API_KEY?.trim() ? "RESEARCH_ONLY" : "NOT_COMMISSIONED",
    },
    artsy: {
      integrationImplemented: false,
      execution: "NOT_COMMISSIONED",
    },
    spendGuard: {
      dailyCeilingConfigured: daily !== undefined,
      lifetimeCeilingConfigured: lifetime !== undefined && daily !== undefined && lifetime >= daily,
      currencyConfigured: validCurrency,
      configured: daily !== undefined && lifetime !== undefined && lifetime >= daily && validCurrency,
    },
  }
}

/** Shared fail-closed operator boundary for provider metadata probes. */
export function isAdsReadinessOwner(userId: string | undefined, expectedOwnerUserId: string | undefined): boolean {
  return Boolean(userId?.trim() && expectedOwnerUserId?.trim() && userId === expectedOwnerUserId.trim())
}
