"use client"

import { useCallback, useEffect, useState } from "react"

type Certificate = {
  success: boolean
  error?: string
  auditScope?: string
  meta?: { tokenPresent: boolean; accountVerified: boolean }
  reddit?: { adsExecutionImplemented: boolean }
  etsy?: { publicMarketplaceResearchImplemented: boolean; sellerOAuthVerified: boolean }
  certificate?: {
    readyForOwnerLaunchReview: boolean
    canActivateAds: false
    canSpend: false
    openIssues: string[]
  }
}
type OAuthStatus = {
  status?: string
  providers?: { etsy?: { readyToAuthorize: boolean; scope: string }; reddit_ads?: { readyToAuthorize: boolean; scope: string } }
}
type StatusResponse = {
  status?: string
  configured?: boolean
  error?: string
  proof?: { verifiedRead?: boolean; permission?: string; targetMatched?: boolean }
}

const checks: Record<string, string> = {
  OWNER_NOT_CONFIGURED: "Configure the exact Jhadina owner ID in Vercel.",
  PROVIDER_TOKEN_NOT_CONFIGURED: "Add a separate Jhadina-scoped Meta/Markifact access token.",
  ADS_ACCOUNT_NOT_VERIFIED: "Verify the intended Meta ad account and the exact Pups on Stuff Page.",
  PAUSED_CAMPAIGN_UNRECONCILED: "Reconcile the existing September 2026 PAUSED Meta campaign. No duplicate.",
  DURABLE_STORAGE_UNAVAILABLE: "Recover SWLC Postgres and prove Growth RLS/receipts.",
  OWNER_DEVICE_NOT_VERIFIED: "Complete the real iPhone portrait acceptance test.",
  BUDGET_GUARD_NOT_CONFIGURED: "Set private, capped budget limits after owner approval.",
  OWNER_SPEND_APPROVAL_NOT_PRESENT: "An independent owner spending approval is required.",
  CREATIVE_AND_PIXEL_EVIDENCE_MISSING: "Review creative rights, landing domain, attribution and pixel.",
}

const shell: React.CSSProperties = {
  minHeight: "100vh", background: "#f7f4ef", color: "#252b27",
  padding: "20px 16px 96px", fontFamily: "system-ui, sans-serif",
}
const panel: React.CSSProperties = {
  background: "#fff", border: "1px solid #e3ded5",
  borderRadius: 18, padding: 17, boxShadow: "0 2px 12px #19241a08",
}
const action: React.CSSProperties = {
  padding: "11px 14px", borderRadius: 12, background: "#24352b",
  color: "white", border: "none", cursor: "pointer", fontSize: 14,
}

export default function AdsConnections() {
  const [certificate, setCertificate] = useState<Certificate | null>(null)
  const [etsy, setEtsy] = useState<StatusResponse | null>(null)
  const [reddit, setReddit] = useState<StatusResponse | null>(null)
  const [metaHealth, setMetaHealth] = useState<StatusResponse | null>(null)
  const [busy, setBusy] = useState("")
  const [oauth, setOauth] = useState<OAuthStatus | null>(null)
  const [oauthOutcome, setOauthOutcome] = useState("")
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setError("")
    const requests = [
      "/api/growth/providers/launch-certificate",
      "/api/growth/providers/external/health?platform=etsy",
      "/api/growth/providers/external/health?platform=reddit_ads",
      "/api/growth/providers/oauth/start",
    ]
    try {
      const results = await Promise.all(requests.map(async url => {
        const response = await fetch(url, { cache: "no-store" })
        return { response, body: await response.json() }
      }))
      setCertificate(results[0].body as Certificate)
      setEtsy(results[1].body as StatusResponse)
      setReddit(results[2].body as StatusResponse)
      setOauth(results[3].body as OAuthStatus)
      if (!results[0].response.ok) setError("Operator commissioning is unavailable. Sign in as the configured owner.")
    } catch {
      setError("Connection status could not be loaded.")
    }
  }, [])

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("oauth")
    if (result === "verified-temporary" || result === "denied" || result === "failed") setOauthOutcome(result)
    void load()
  }, [load])

  const verify = async (platform: "etsy" | "reddit_ads") => {
    setBusy(platform)
    try {
      const response = await fetch(
        "/api/growth/providers/external/health?platform=" + platform + "&probe=1",
        { cache: "no-store" },
      )
      const result = await response.json() as StatusResponse
      if (platform === "etsy") setEtsy(result)
      else setReddit(result)
    } catch {
      setError("The read-only provider check failed.")
    } finally { setBusy("") }
  }

  async function verifyMetaCapability() {
    setBusy("meta")
    setError("")
    try {
      const response = await fetch("/api/growth/providers/markifact/health?channel=meta", { cache: "no-store" })
      const result = await response.json() as StatusResponse
      setMetaHealth(result)
    } catch {
      setError("Meta capability could not be checked. No campaign was created.")
    } finally { setBusy("") }
  }

  async function authorizeReadOnly(platform: "etsy" | "reddit_ads") {
    setBusy("authorize:" + platform)
    setError("")
    try {
      const response = await fetch("/api/growth/providers/oauth/start", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform }), cache: "no-store",
      })
      const body = await response.json() as { authorizeUrl?: string; status?: string }
      if (!response.ok || !body.authorizeUrl) throw new Error(body.status || "OAUTH_NOT_CONFIGURED")
      const target = new URL(body.authorizeUrl)
      const expectedHost = platform === "etsy" ? "www.etsy.com" : "www.reddit.com"
      if (target.protocol !== "https:" || target.hostname !== expectedHost) throw new Error("UNTRUSTED_CONSENT_DESTINATION")
      window.location.assign(target.href)
    } catch {
      setError("Read-only authorization could not start. Check owner login and the provider configuration.")
      setBusy("")
    }
  }

  const platforms = [
    { id: "meta", title: "Meta · Facebook / Instagram", configured: certificate?.meta?.tokenPresent ?? false,
      line: "Jhadina's own runtime authorization is separate from ChatGPT's linked Meta account.",
      state: certificate?.meta?.accountVerified ? "Account verified" : "Account not verified" },
    { id: "etsy", title: "Etsy · Marketplace", configured: etsy?.configured ?? false,
      line: "Open API shop research, not advertising or listing-write authority.",
      state: etsy?.status ?? "Not checked" },
    { id: "reddit_ads", title: "Reddit Ads", configured: reddit?.configured ?? false,
      line: "Ads API adsread is distinct from the Devvit community API.",
      state: reddit?.status ?? "Not checked" },
  ] as const

  return <main style={shell}>
    <div style={{ maxWidth: 790, margin: "0 auto", display: "grid", gap: 18 }}>
      <nav aria-label="Growth navigation"><a href="/growth" style={{ color: "#647568" }}>← Growth</a></nav>
      <header>
        <div style={{ color: "#75816f", fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase" }}>Jhadina Growth · Ads Connect</div>
        <h1 style={{ fontFamily: "Georgia,serif", fontWeight: 400, fontSize: "clamp(32px,7vw,54px)", margin: "10px 0" }}>Connections, not clutter.</h1>
        <p style={{ lineHeight: 1.6, color: "#526259", margin: 0 }}>Check integrations and launch blockers in one place. No campaign can be activated or funded here.</p>
      </header>
      <section style={panel} aria-label="Launch status">
        <strong style={{ fontSize: 20 }}>Launch certification</strong>
        <p style={{ marginBottom: 0, color: "#7d5439" }}>Not commissioned · Spending and publishing disabled</p>
        {certificate?.certificate && <p style={{ color: "#56655c", fontSize: 14 }}>
          {certificate.certificate.openIssues.length} outstanding evidence checks.
        </p>}
        {error && <p role="alert" style={{ color: "#9f443f" }}>{error}</p>}
        <button type="button" onClick={() => void load()} style={{ ...action, background: "#e6ece4", color: "#27392c" }}>Refresh evidence</button>
      </section>
      {oauthOutcome && <section role="status" style={panel}>{oauthOutcome === "verified-temporary" ? "Read-only provider and account verification succeeded for this session. Tokens were discarded; this is not a saved connection or launch approval." : oauthOutcome === "denied" ? "Provider consent was declined. No connection or spend was made." : "Authorization was not completed or could not be verified. No connection or spend was made."}</section>}
      <section aria-label="Advertising platforms" style={{ display: "grid", gap: 12 }}>
        {platforms.map(platform => <article key={platform.id} style={panel}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <strong>{platform.title}</strong>
            <span style={{ fontSize: 12, color: platform.configured ? "#2a6946" : "#865734" }}>
              {platform.configured ? "Runtime configuration present" : "Runtime not configured"}
            </span>
          </div>
          <p style={{ color: "#55675b", lineHeight: 1.55, fontSize: 14 }}>{platform.line}</p>
          <div style={{ color: "#62685d", fontSize: 13, marginBottom: 12 }}>Read evidence: {platform.state}</div>
          {platform.id === "meta" && <>
            <p style={{ color: "#526259", fontSize: 13 }}>
              {metaHealth?.status ?? "Capability not checked"} · account binding remains unverified
            </p>
            <button type="button" style={{ ...action, marginBottom: 8 }}
              disabled={busy !== "" || !platform.configured} onClick={() => void verifyMetaCapability()}>
              {busy === "meta" ? "Checking…" : "Verify Meta API capability"}
            </button>
          </>}
          {platform.id !== "meta" && <>
            <p style={{ fontSize: 13, color: "#58655a" }}>
              Read-only consent: {oauth?.providers?.[platform.id]?.readyToAuthorize
                ? "Available · " + oauth.providers[platform.id]?.scope
                : "Owner credentials and an exact callback must be configured"}
            </p>
            <button
              type="button" style={{ ...action, marginRight: 8, marginBottom: 8 }}
              disabled={busy !== "" || !oauth?.providers?.[platform.id]?.readyToAuthorize}
              onClick={() => void authorizeReadOnly(platform.id)}
            >{busy === "authorize:" + platform.id ? "Redirecting…" : "Authorize read access"}</button>
          </>}
          {platform.id !== "meta" && <button
            type="button" style={action} disabled={busy !== "" || !platform.configured}
            onClick={() => void verify(platform.id)}
          >{busy === platform.id ? "Checking…" : "Verify read access"}</button>}
        </article>)}
      </section>
      <section style={panel}>
        <h2 style={{ fontSize: 20, marginTop: 0 }}>Remaining launch evidence</h2>
        <ol style={{ paddingLeft: 24, lineHeight: 1.7, color: "#526259" }}>
          {(certificate?.certificate?.openIssues ?? Object.keys(checks)).map(item =>
            <li key={item}>{checks[item] ?? item}</li>
          )}
        </ol>
      </section>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: "#68766b" }}>
        Etsy&apos;s Dev MCP is a documentation reference. Reddit Devvit is a community app framework.
        Neither is an advertising account authorization. Provider secrets and account IDs are not shown.
      </p>
    </div>
  </main>
}
