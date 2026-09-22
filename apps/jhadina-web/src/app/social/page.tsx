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

type PublicationProposal = {
  id: string
  brand: string
  text: string
  scheduledAt?: string
  status: string
  approvalReceiptId?: string
  targets: Array<{
    accountId: string
    platform: string
    provider: string
    providerProfileId: string
  }>
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

const providers = [
  ["hootsuite", "Hootsuite"],
  ["ayrshare", "Ayrshare"],
] as const

export default function SocialCommandCenter() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [profiles, setProfiles] = useState<ProviderProfile[]>([])
  const [items, setItems] = useState<HubItem[]>([])
  const [proposals, setProposals] = useState<PublicationProposal[]>([])
  const [batchSelected, setBatchSelected] = useState<string[]>([])
  const [brand, setBrand] = useState("jhadinatv")
  const [provider, setProvider] = useState("hootsuite")
  const [text, setText] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [pending, setPending] = useState<PendingApproval | null>(null)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")

  async function load() {
    setError("")
    try {
      const [accountsResponse, hubResponse, proposalsResponse] = await Promise.all([
        fetch("/api/social/profiles", { cache: "no-store" }),
        fetch("/api/social/hub", { cache: "no-store" }),
        fetch("/api/social/posts", { cache: "no-store" }),
      ])
      const accountsJson = await accountsResponse.json()
      const hubJson = await hubResponse.json()
      const proposalsJson = await proposalsResponse.json()
      if (!accountsResponse.ok) throw new Error(accountsJson.error || "Could not load social accounts")
      if (!hubResponse.ok) throw new Error(hubJson.error || "Could not load Social Hub")
      if (!proposalsResponse.ok) throw new Error(proposalsJson.error || "Could not load publication proposals")
      setAccounts(accountsJson.data ?? [])
      setItems(hubJson.data?.items ?? [])
      setProposals(proposalsJson.data ?? [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load Social")
    }
  }

  useEffect(() => { void load() }, [])

  const eligibleAccounts = useMemo(
    () => accounts.filter((account) => account.brand === brand && account.status === "connected"),
    [accounts, brand],
  )

  const pendingCalendar = useMemo(
    () => proposals
      .filter((proposal) =>
        proposal.brand === brand &&
        proposal.status === "pending_approval" &&
        !!proposal.approvalReceiptId &&
        !!proposal.scheduledAt &&
        proposal.targets.length === 1 &&
        Date.parse(proposal.scheduledAt) > Date.now(),
      )
      .sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!)),
    [proposals, brand],
  )

  useEffect(() => {
    setSelected([])
    setPending(null)
    setBatchSelected([])
  }, [brand])

  useEffect(() => {
    setProfiles([])
  }, [provider])

  async function discover() {
    setBusy("discover"); setError("")
    try {
      const response = await fetch(`/api/social/profiles?discover=${encodeURIComponent(provider)}`, { cache: "no-store" })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || `Could not discover ${provider} profiles`)
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
        body: JSON.stringify({ brand, provider, providerProfileId: profile.id }),
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
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
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

  async function approveCalendarBatch() {
    if (!batchSelected.length) return
    setBusy("batch"); setError("")
    try {
      const response = await fetch("/api/social/calendar/batches/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          batchId: `social-calendar:${brand}:${crypto.randomUUID()}`,
          proposalIds: batchSelected,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Calendar batch approval failed")
      if (json.data?.status === "partial") {
        setError("Some scheduled posts were approved while others failed. Review the remaining pending items before retrying.")
      }
      setBatchSelected([])
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Calendar batch approval failed")
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
      setScheduledAt("")
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
      <p style={{ maxWidth: 700, lineHeight: 1.65, color: "#69766f" }}>
        Connect exact accounts, prepare platform-specific content, schedule it, approve the immutable publication, and let the provider deliver automatically at the approved time. Jhadina never expands an account selection or silently self-approves generated content.
      </p>

      {error && <div role="alert" style={{ margin: "18px 0", padding: 14, borderRadius: 16, background: "#f5e1dc", color: "#8d5148" }}>{error}</div>}

      <section style={panel}>
        <div style={eyebrow}>ACCOUNTS</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "10px 0 14px" }}>
          <select value={brand} onChange={(event) => setBrand(event.target.value)} style={input}>
            {brands.map(([id, label]) => <option value={id} key={id}>{label}</option>)}
          </select>
          <select value={provider} onChange={(event) => setProvider(event.target.value)} style={input}>
            {providers.map(([id, label]) => <option value={id} key={id}>{label}</option>)}
          </select>
          <button type="button" onClick={discover} disabled={!!busy} style={secondary}>
            {busy === "discover" ? "Checking…" : `Discover ${providers.find(([id]) => id === provider)?.[1] ?? provider} profiles`}
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
                <span><strong>{account.displayName}</strong> · {account.platform} · {account.provider}{account.handle ? ` · @${account.handle}` : ""}</span>
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
        <div style={eyebrow}>PUBLICATION + AUTOMATION</div>
        <textarea
          value={text}
          onChange={(event) => { setText(event.target.value); setPending(null) }}
          rows={5}
          placeholder="Write or paste the post Jhadina should prepare for approval…"
          style={{ ...input, width: "100%", resize: "vertical", margin: "12px 0" }}
        />
        <div style={{ display: "grid", gap: 7, maxWidth: 420, marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#66736c" }} htmlFor="social-schedule">Optional publish time</label>
          <input
            id="social-schedule"
            type="datetime-local"
            value={scheduledAt}
            min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
            onChange={(event) => { setScheduledAt(event.target.value); setPending(null) }}
            style={input}
          />
          <div style={{ fontSize: 11, color: "#879089" }}>
            Leave blank to publish after approval now. Set a future time to approve once and have the provider publish automatically then.
          </div>
        </div>
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
            {busy === "publish"
              ? "Dispatching…"
              : scheduledAt
                ? "Approve & schedule"
                : "Approve & publish"}
          </button>}
        </div>
        {pending && <p style={{ color: "#725f42", lineHeight: 1.5 }}>
          Approval is pending. The provider has not been called yet. Approval consumes this receipt once and binds the exact text, media, destination accounts, and schedule.
        </p>}
      </section>

      <section style={panel}>
        <div style={eyebrow}>CONTENT CALENDAR</div>
        <h2 style={{ fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 400 }}>Batch review scheduled posts</h2>
        <p style={{ color: "#69766f", lineHeight: 1.55 }}>
          Select exact pending posts for this brand and approve them together. Each post keeps its own immutable public.publish receipt; this does not grant open-ended future posting authority.
        </p>
        <div style={{ display: "grid", gap: 8, margin: "14px 0" }}>
          {pendingCalendar.length
            ? pendingCalendar.map((proposal) => <label key={proposal.id} style={row}>
                <div>
                  <div style={{ fontWeight: 650 }}>{proposal.text.length > 90 ? `${proposal.text.slice(0, 90)}…` : proposal.text}</div>
                  <div style={{ fontSize: 12, color: "#76827b", marginTop: 4 }}>
                    {proposal.targets[0]?.platform} · {proposal.targets[0]?.provider} · {new Date(proposal.scheduledAt!).toLocaleString()}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={batchSelected.includes(proposal.id)}
                  onChange={(event) => setBatchSelected((current) =>
                    event.target.checked ? [...current, proposal.id] : current.filter((id) => id !== proposal.id),
                  )}
                />
              </label>)
            : <div style={{ color: "#748078" }}>No future scheduled posts are waiting for approval for this brand.</div>}
        </div>
        {pendingCalendar.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            style={secondary}
            disabled={!!busy}
            onClick={() => setBatchSelected(pendingCalendar.map((proposal) => proposal.id))}
          >
            Select all
          </button>
          <button
            type="button"
            style={primary}
            disabled={!!busy || batchSelected.length === 0}
            onClick={approveCalendarBatch}
          >
            {busy === "batch" ? "Approving calendar…" : `Approve ${batchSelected.length} scheduled post${batchSelected.length === 1 ? "" : "s"}`}
          </button>
        </div>}
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
