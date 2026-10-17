import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { probeRedditAdsAccount } from "./external-ads-probes"

export type AdsOAuthPlatform = "etsy" | "reddit_ads"
export type AdsOAuthSession = {
  platform: AdsOAuthPlatform
  ownerUserId: string
  state: string
  verifier: string
  expiresAt: number
}

type OAuthSettings = {
  platform: AdsOAuthPlatform
  clientId: string
  clientSecret?: string
  callback: string
  account: string
  etsyKey?: string
}

function nonempty(value: string | undefined): string {
  return value?.trim() ?? ""
}

export function adsOAuthSettings(
  env: Readonly<Record<string, string | undefined>>,
  platform: AdsOAuthPlatform,
  requestOrigin: string,
): OAuthSettings | undefined {
  const callback = nonempty(platform === "etsy" ? env.ETSY_OAUTH_REDIRECT_URI : env.REDDIT_ADS_REDIRECT_URI)
  const expectedPath = "/api/growth/providers/oauth/callback"
  let url: URL
  try { url = new URL(callback) } catch { return undefined }
  if (
    (url.protocol !== "https:" && !(url.hostname === "localhost" && url.protocol === "http:")) ||
    url.origin !== requestOrigin || url.pathname !== expectedPath || url.search || url.hash
  ) return undefined
  if (platform === "etsy") {
    const key = nonempty(env.ETSY_API_KEY)
    const shopId = nonempty(env.ETSY_SHOP_ID)
    const clientId = key.includes(":") ? key.slice(0, key.indexOf(":")) : ""
    if (!key || !clientId || !/^[1-9][0-9]{0,17}$/.test(shopId)) return undefined
    return { platform, clientId, account: shopId, callback, etsyKey: key }
  }
  const clientId = nonempty(env.REDDIT_ADS_CLIENT_ID)
  const clientSecret = nonempty(env.REDDIT_ADS_CLIENT_SECRET)
  const account = nonempty(env.REDDIT_ADS_ACCOUNT_ID)
  if (!clientId || !clientSecret || !/^[A-Za-z0-9_-]{2,80}$/.test(account)) return undefined
  return { platform, clientId, clientSecret, account, callback }
}

function keyFromSecret(secret: string): Buffer {
  if (!secret || secret.length < 32) throw new Error("ADS_OAUTH_COOKIE_SECRET_MISSING")
  return createHash("sha256").update("jhadina-ads-oauth-v1:").update(secret).digest()
}

/** Confidential authenticated short-lived cookie: only PKCE/state, never provider tokens. */
export function sealAdsOAuthSession(session: AdsOAuthSession, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url")
}

export function unsealAdsOAuthSession(cookie: string | undefined, secret: string): AdsOAuthSession {
  if (!cookie || cookie.length > 4096) throw new Error("ADS_OAUTH_SESSION_INVALID")
  const bytes = Buffer.from(cookie, "base64url")
  if (bytes.length < 29) throw new Error("ADS_OAUTH_SESSION_INVALID")
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyFromSecret(secret), bytes.subarray(0, 12))
    decipher.setAuthTag(bytes.subarray(12, 28))
    const parsed = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8")) as AdsOAuthSession
    if (
      (parsed.platform !== "etsy" && parsed.platform !== "reddit_ads") ||
      typeof parsed.ownerUserId !== "string" || !parsed.ownerUserId ||
      typeof parsed.state !== "string" || parsed.state.length < 24 ||
      typeof parsed.verifier !== "string" || parsed.verifier.length < 43 ||
      !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= Date.now() ||
      parsed.expiresAt - Date.now() > 11 * 60 * 1000
    ) throw new Error("ADS_OAUTH_SESSION_INVALID")
    return parsed
  } catch {
    throw new Error("ADS_OAUTH_SESSION_INVALID")
  }
}

export function adsOAuthAuthorizeUrl(
  config: OAuthSettings,
  ownerUserId: string,
  now = Date.now(),
): { authorizeUrl: string; pending: AdsOAuthSession } {
  if (!ownerUserId.trim()) throw new Error("ADS_OAUTH_OWNER_REQUIRED")
  const state = randomBytes(24).toString("base64url")
  const verifier = randomBytes(32).toString("base64url")
  const pending: AdsOAuthSession = { platform: config.platform, ownerUserId, state, verifier, expiresAt: now + 600_000 }
  const url = new URL(config.platform === "etsy"
    ? "https://www.etsy.com/oauth/connect"
    : "https://www.reddit.com/api/v1/authorize")
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.callback)
  url.searchParams.set("state", state)
  if (config.platform === "etsy") {
    url.searchParams.set("scope", "shops_r")
    url.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"))
    url.searchParams.set("code_challenge_method", "S256")
  } else {
    url.searchParams.set("scope", "adsread")
    url.searchParams.set("duration", "temporary")
  }
  return { authorizeUrl: url.toString(), pending }
}

export function assertAdsOAuthCallback(
  session: AdsOAuthSession,
  state: string | null,
  platform: AdsOAuthPlatform,
  ownerUserId: string,
): void {
  const expected = Buffer.from(session.state)
  const received = Buffer.from(state ?? "")
  if (
    session.platform !== platform || session.ownerUserId !== ownerUserId ||
    session.expiresAt <= Date.now() || expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) throw new Error("ADS_OAUTH_CALLBACK_REJECTED")
}

function hasReadScope(granted: unknown, expected: string): boolean {
  return typeof granted === "string" && granted.split(/[\s,]+/).includes(expected)
}

export async function finishAdsOAuthReadCanary(
  input: {
    config: OAuthSettings
    session: AdsOAuthSession
    code: string
    fetchFn?: typeof fetch
  },
): Promise<{ platform: AdsOAuthPlatform; readVerified: true; tokensPersisted: false; spendAuthorized: false }> {
  const { config, session, code } = input
  if (config.platform !== session.platform || !code || code.length > 2048) throw new Error("ADS_OAUTH_EXCHANGE_NOT_ALLOWED")
  const fetcher = input.fetchFn ?? fetch
  const payload = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.callback,
  })
  let url: string
  let headers: Record<string, string>
  if (config.platform === "etsy") {
    payload.set("client_id", config.clientId)
    payload.set("code_verifier", session.verifier)
    url = "https://api.etsy.com/v3/public/oauth/token"
    headers = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }
  } else {
    url = "https://www.reddit.com/api/v1/access_token"
    headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: "Basic " + Buffer.from(config.clientId + ":" + config.clientSecret).toString("base64"),
      "User-Agent": "JhadinaAdsConnect/1.0 (read-only OAuth verification)",
    }
  }
  const response = await fetcher(url, {
    method: "POST", headers, body: payload.toString(), redirect: "error", cache: "no-store",
  })
  if (!response.ok) throw new Error("ADS_OAUTH_TOKEN_EXCHANGE_FAILED")
  const value = await response.json() as Record<string, unknown>
  const token = typeof value.access_token === "string" ? value.access_token : ""
  const scope = config.platform === "etsy" ? "shops_r" : "adsread"
  if (!token || !hasReadScope(value.scope, scope)) throw new Error("ADS_OAUTH_SCOPE_NOT_GRANTED")
  if (config.platform === "reddit_ads") {
    await probeRedditAdsAccount({ token, accountId: config.account, fetchFn: fetcher })
  } else {
    // Etsy tokens have an owner numeric ID prefix; cross-check against the
    // public "getShopByOwnerUserId" endpoint and exact configured shop.
    const ownerId = /^([1-9][0-9]{0,17})\./.exec(token)?.[1]
    if (!ownerId) throw new Error("ETSY_OWNER_TOKEN_INVALID")
    const shop = await fetcher("https://api.etsy.com/v3/application/users/" + ownerId + "/shops", {
      method: "GET", headers: { "x-api-key": config.etsyKey!, Accept: "application/json" },
      redirect: "error", cache: "no-store",
    })
    if (!shop.ok) throw new Error("ETSY_OWNER_SHOP_READ_FAILED")
    const data = await shop.json() as Record<string, unknown>
    if (String(data.shop_id ?? "") !== config.account || String(data.user_id ?? "") !== ownerId) {
      throw new Error("ETSY_OWNER_SHOP_MISMATCH")
    }
  }
  // Never serialize token/refresh_token, write DB, set browser token cookies,
  // or claim a durable connected provider. Revocation/reauthorization is
  // required once the canonical encrypted credential store is commissioned.
  return { platform: config.platform, readVerified: true, tokensPersisted: false, spendAuthorized: false }
}
