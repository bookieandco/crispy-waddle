/**
 * ADS-CONNECT.06-.08. Exact-account, read-only probes only.
 * Devvit is not Reddit Ads OAuth. Etsy Dev MCP is documentation, not a shop API.
 * Neither successful probe authorizes writing, publishing, spending or ownership.
 */
export type ExternalAdsProof = Readonly<{
  platform: "reddit_ads" | "etsy_marketplace"
  verifiedRead: true
  permission: "adsread" | "public_shop_read"
  targetMatched: true
  accountOwned: false
  publishAuthorized: false
  spendAuthorized: false
  endpoint: string
}>

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined
}

function positiveShopId(id: string): string {
  if (!/^[1-9][0-9]{0,17}$/.test(id)) throw new Error("ETSY_SHOP_ID_INVALID")
  return id
}
function redditAccountId(id: string): string {
  if (!/^[a-zA-Z0-9_-]{2,80}$/.test(id)) throw new Error("REDDIT_ADS_ACCOUNT_ID_INVALID")
  return id
}

/** Reddit Ads API v3 GET /ad_accounts/{ad_account_id}, adsread only. */
export async function probeRedditAdsAccount(input: {
  token: string
  accountId: string
  fetchFn?: typeof fetch
}): Promise<ExternalAdsProof> {
  if (!input.token?.trim()) throw new Error("REDDIT_ADS_OAUTH_NOT_CONFIGURED")
  const id = redditAccountId(input.accountId)
  const endpoint = "https://ads-api.reddit.com/api/v3/ad_accounts/" + encodeURIComponent(id)
  const response = await (input.fetchFn ?? fetch)(endpoint, {
    method: "GET",
    headers: { Authorization: "Bearer " + input.token.trim(), Accept: "application/json" },
    redirect: "error",
    cache: "no-store",
  })
  if (!response.ok) throw new Error("REDDIT_ADS_READ_FAILED:" + response.status)
  const root = object(await response.json())
  const nested = object(root?.data) ?? object(root?.ad_account) ?? root
  // A 200 response without the exact account ID is not proof of target authorization.
  if (!nested || String(nested.id ?? nested.ad_account_id ?? "") !== id) {
    throw new Error("REDDIT_ADS_ACCOUNT_PROOF_MISMATCH")
  }
  return {
    platform: "reddit_ads", verifiedRead: true, permission: "adsread",
    targetMatched: true, accountOwned: false, publishAuthorized: false,
    spendAuthorized: false, endpoint: "reddit_ads_v3_get_ad_account",
  }
}

/** Etsy Open API v3 getShop uses x-api-key, not seller OAuth or Dev MCP. */
export async function probeEtsyPublicShop(input: {
  apiKey: string
  shopId: string
  fetchFn?: typeof fetch
}): Promise<ExternalAdsProof> {
  if (!input.apiKey?.trim()) throw new Error("ETSY_API_KEY_NOT_CONFIGURED")
  const id = positiveShopId(input.shopId)
  const endpoint = "https://api.etsy.com/v3/application/shops/" + id
  const response = await (input.fetchFn ?? fetch)(endpoint, {
    method: "GET",
    headers: { "x-api-key": input.apiKey.trim(), Accept: "application/json" },
    redirect: "error",
    cache: "no-store",
  })
  if (!response.ok) throw new Error("ETSY_PUBLIC_SHOP_READ_FAILED:" + response.status)
  const payload = object(await response.json())
  if (!payload || String(payload.shop_id ?? "") !== id) {
    throw new Error("ETSY_SHOP_PROOF_MISMATCH")
  }
  return {
    platform: "etsy_marketplace", verifiedRead: true, permission: "public_shop_read",
    targetMatched: true, accountOwned: false, publishAuthorized: false,
    spendAuthorized: false, endpoint: "etsy_open_api_v3_get_shop",
  }
}
