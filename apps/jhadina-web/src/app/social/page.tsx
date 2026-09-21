"use client"

import { useEffect, useMemo, useState } from "react"

type Account = {
  id: string
  brand: string
  provider: string
  providerProfileId: string
  platform: string
  displayName: string
  handle?: string
  status: string
}

type ProviderProfile = {
  id: string
  provider: string
  platform: string
  name: string
  handle?: string
}

type HubItem = {
  id: string
  source: "publication" | "observation"
  occurredAt: string
  platform?: string
  title: string
  status?: string
  provenance: string[]
}

type PendingApproval = {
  proposalId: string
  receiptId: string
}

const brands = [
  ["jhadinatv", "JhadinaTV"],
  ["jhadina-music", "Jhadina Music"],
  ["overageos", "OverageOS"],
  ["bookieandco", "Bookie & Co."],
  ["jhadina", "Jhadina"],
  ["pupsonstuff", "PupsonStuff"],
  ["atwood-bookie", "Atwood Bookie"],
] as const

export default function SocialCommandCenter() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [profiles, setProfiles] = useState<ProviderProfile[]>([])
  const [items, setItems] = useState<HubItem[]>([])
  const [brand, setBrand] = useState("jhadinatv")
  const [text, setText] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [pending, setPending] = useState<PendingApproval | null>(null)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")

  async function load() {
    setError("")
    try {
      const [accountsResponse, hubResponse] = await Promise.all([
        fetch("/api/social/profiles", { cache: "no-store" }),
        fetch("/api/social/hub", { cache: "no-store" }),
      ])
      const accountsJson = await accountsResponse.json()
      const hubJson = await hubResponse.json()
      if (!accountsResponse.ok) throw new Error(accountsJson.error || "Could not load social accounts")
      if (!hubResponse.ok) throw new Error(hubJson.error || "Could not load Social Hub")
      setAccounts(accountsJson.data ?? [])
      setItems(hubJson.data?.items ?? [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load Social")
    }
  }

  useEffect(() => { void load() }, [])

  const eligibleAccounts = useMemo(
    () => accounts.filter((account) => account.brand === brand && account.status === "connected"),
    [accounts, brand],
  )

  useEffect(() => {
    setSelected([])
    setPending(null)
  }, [brand])

  async function discover() {
    setBusy("discover"); setError("")
    try {
      const response = await fetch("/api/social/profiles?discover=hootsuite", { cache: "no-store" })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Could not discover Hootsuite profiles")
      setProfiles(json.data ?? [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Discovery failed")
    } finally { setBusy("") }
  }

  async function register(profile: ProviderProfile) {
    setBusy(`register:${profile.id}`); setError("")
    try {
      const response = await fetch("/api/social/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brand, providerProfileId: profile.id }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Could not connect social profile")
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connection failed")
    } finally { setBusy("") }
  }

  async function requestApproval() {
    setBusy("proposal"); setError("")
    try {
      const response = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brand,
          text,
          targetAccountIds: selected,
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Could not create publication proposal")
      setPending({
        proposalId: json.data.proposal.id,
        receiptId: json.data.approval.receiptId,
      })
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Proposal failed")
    } finally { setBusy("") }
  }

  async function approveAndPublish() {
    if (!pending) return
    setBusy("publish"); setError("")
    try {
      const response = await fetch(`/api/social/posts/${pending.proposalId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approvalReceiptId: pending.receiptId }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Publication failed")
      setPending(null)
      setText("")
      setSelected([])
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Publication failed")
    } finally { setBusy("") }
  }

  return <main style={{ minHeight: "100vh", padding: "28px 18px 100px", background: "#f4f1ea", color: "#29332e", fontFamily: 'ui-rounded,"Avenir Next",Avenir,system-ui,sans-serif' }}>
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={eyebrow}>Jhadina Social</div>
      <h1 style={{ margin: "10px 0 8px", fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 400, fontSize: "clamp(38px,8vw,60px)", lineHeight: 1 }}>One social control plane.</h1>
      <p style={{ maxWidth: 650, lineHeight: 1.65, color: "#69766f" }}>Connect exact accounts, prepare one publication proposal, then explicitly approve it. Jhadina never expands a platform selection into every connected profile.</p>

      {error && <div role="alert" style={{ margin: "18px 0", padding: 14, borderRadius: 16, background: "#f5e1dc", color: "#8d5148" }}>{error}</div>}

      <section style={panel}>
        <div style={eyebrow}>ACCOUNTS</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "10px 0 14px" }}>
          <select value={brand} onChange={(event) => setBrand(event.target.value)} style={input}>
            {brands.map(([id, label]) => <option value={id} key={id}>{label}</option>)}
          </select>
          <button type="button" onClick={discover} disabled={!!busy} style={secondary}>
            {busy === "discover" ? "Checking…" : "Discover Hootsuite profiles"}
          </button>
        </div>
        {profiles.length > 0 && <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          {profiles.map((profile) => <div key={profile.id} style={row}>
            <span><strong>{profile.name}</strong> · {profile.platform}{profile.handle ? ` · @${profile.handle}` : ""}</span>
            <button type="button" onClick={() => register(profile)} disabled={!!busy} style={secondary}>
              {busy === `register:${profile.id}` ? "Connecting…" : "Bind to brand"}
            </button>
          </div>)}
        </div>}
        <div style={{ display: "grid", gap: 8 }}>
          {eligibleAccounts.length
            ? eligibleAccounts.map((account) => <label key={account.id} style={row}>
                <span><strong>{account.displayName}</strong> · {account.platform}{account.handle ? ` · @${account.handle}` : ""}</span>
                <input
                  type="checkbox"
                  checked={selected.includes(account.id)}
                  onChange={(event) => setSelected((current) =>
                    event.target.checked ? [...current, account.id] : current.filter((id) => id !== account.id),
                  )}
                />
              </label>)
            : <div style={{ color: "#748078" }}>No connected account is bound to this brand yet.</div>}
        </div>
      </section>

      <section style={panel}>
        <div style={eyebrow}>PUBLICATION PROPOSAL</div>
        <textarea
          value={text}
          onChange={(event) => { setText(event.target.value); setPending(null) }}
          rows={5}
          placeholder="Write or paste the post Jhadina should prepare for approval…"
          style={{ ...input, width: "100%", resize: "vertical", margin: "12px 0" }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={requestApproval}
            disabled={!!busy || !text.trim() || selected.length === 0 || !!pending}
            style={primary}
          >
            {busy === "proposal" ? "Preparing…" : "Request publication approval"}
          </button>
          {pending && <button type="button" onClick={approveAndPublish} disabled={!!busy} style={primary}>
            {busy === "publish" ? "Publishing…" : "Approve & publish"}
          </button>}
        </div>
        {pending && <p style={{ color: "#725f42", lineHeight: 1.5 }}>Approval is pending. The provider has not been called yet. “Approve & publish” consumes this receipt once.</p>}
      </section>

      <section style={panel}>
        <div style={eyebrow}>SOCIAL HUB</div>
        <h2 style={{ fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 400 }}>Recent governed activity</h2>
        <div style={{ display: "grid", gap: 9 }}>
          {items.length
            ? items.slice(0, 30).map((item) => <article key={item.id} style={row}>
                <div>
                  <div style={{ fontWeight: 650 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: "#76827b", marginTop: 4 }}>
                    {item.source}{item.platform ? ` · ${item.platform}` : ""}{item.status ? ` · ${item.status}` : ""}
                  </div>
                </div>
                <time style={{ fontSize: 11, color: "#879089" }}>{new Date(item.occurredAt).toLocaleString()}</time>
              </article>)
            : <div style={{ color: "#748078" }}>No Social observations or publication receipts yet.</div>}
        </div>
      </section>
    </div>
  </main>
}

const eyebrow = { fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase" as const, color: "#77847c" }
const panel = { marginTop: 24, padding: 20, borderRadius: 24, background: "rgba(255,255,255,.72)", border: "1px solid #dce2dd", boxShadow: "0 14px 38px rgba(67,76,69,.06)" }
const row = { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", padding: 12, borderRadius: 14, background: "#eef1ed" }
const input = { border: "1px solid #d6ddd7", borderRadius: 14, padding: "11px 13px", background: "rgba(255,255,255,.9)", color: "#29332e", font: "inherit" }
const primary = { border: 0, borderRadius: 999, padding: "10px 17px", background: "#34443c", color: "#f8f6f1", fontWeight: 650, cursor: "pointer" }
const secondary = { border: "1px solid #d4dcd5", borderRadius: 999, padding: "9px 15px", background: "rgba(255,255,255,.7)", color: "#56635c", fontWeight: 600, cursor: "pointer" }
