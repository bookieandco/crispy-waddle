"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

type Bucket = "pursue" | "test" | "watch"
type Card = { opportunity: { id: string; title: string; description: string; class: string; strategy: string; source: { name: string; url?: string }; economics: { currency: string; estimatedRevenue?: { min?: number; max?: number }; startupCost?: number; estimatedHours?: number }; score?: { total: number; evidenceConfidence: number; personalFit: number }; status: string; deadline?: string; requiresApproval: boolean }; rank: number; bucket: Bucket; evidenceConfidence: number; rationale: string[] }
type Snapshot = { generatedAt: string; totals: { found: number; pursue: number; test: number; watch: number }; cards: Card[] }

const FILTERS: { id: "all" | Bucket; label: string }[] = [{ id: "all", label: "All" }, { id: "pursue", label: "Pursue" }, { id: "test", label: "Test" }, { id: "watch", label: "Watch" }]

export default function CanonicalOpportunityCommandCenter() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function load() {
    setError("")
    try {
      const res = await fetch("/api/opportunities", { cache: "no-store", headers: { "x-jhadina-user-id": "user_demo" } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not load opportunities")
      setSnapshot(json.data)
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load opportunities") }
  }
  useEffect(() => { void load() }, [])

  async function approve(id: string) {
    setBusy(id); setError("")
    try {
      const res = await fetch("/api/opportunities/approve", { method: "POST", headers: { "content-type": "application/json", "x-jhadina-user-id": "user_demo" }, body: JSON.stringify({ opportunityId: id }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not approve this opportunity")
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : "Could not approve this opportunity") }
    finally { setBusy(null) }
  }

  const cards = useMemo(() => (snapshot?.cards ?? []).filter(c => !dismissed.has(c.opportunity.id) && (filter === "all" || c.bucket === filter)), [snapshot, filter, dismissed])

  return <main style={page}><div style={wrap}>
    <div style={eyebrow}>Jhadina Growth · Money Command Center</div>
    <h1 style={h1}>Opportunities, on your terms.</h1>
    <p style={sub}>Jhadina continuously finds, evaluates, and ranks opportunities. Recommendations stay inspectable; external action remains behind your approval.</p>

    <div style={metrics}>
      <Metric label="Found" value={snapshot?.totals.found ?? 0} /><Metric label="Pursue" value={snapshot?.totals.pursue ?? 0} /><Metric label="Test" value={snapshot?.totals.test ?? 0} /><Metric label="Watch" value={snapshot?.totals.watch ?? 0} />
    </div>
    <div style={filters}>{FILTERS.map(f => <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} style={{ ...chip, ...(filter === f.id ? activeChip : {}) }}>{f.label}</button>)}</div>
    {error && <div role="alert" style={warning}>{error}</div>}
    {!snapshot ? <div style={empty}>Loading opportunities…</div> : cards.length === 0 ? <div style={empty}>Nothing in this view right now.</div> : <section>{cards.map(card => <OpportunityCard key={card.opportunity.id} card={card} busy={busy === card.opportunity.id} saved={saved.has(card.opportunity.id)} onApprove={() => approve(card.opportunity.id)} onSave={() => setSaved(s => new Set(s).add(card.opportunity.id))} onDismiss={() => setDismissed(s => new Set(s).add(card.opportunity.id))} />)}</section>}
  </div></main>
}

function OpportunityCard({ card, busy, saved, onApprove, onSave, onDismiss }: { card: Card; busy: boolean; saved: boolean; onApprove: () => void; onSave: () => void; onDismiss: () => void }) {
  const o = card.opportunity, score = o.score?.total ?? 0, confidence = o.score?.evidenceConfidence ?? card.evidenceConfidence
  return <article style={cardStyle}>
    <div style={topline}><span>{formatLabel(o.class)} · {formatLabel(o.strategy)}</span><span style={{ color: "#8b7b9d" }}>#{card.rank} · {card.bucket.toUpperCase()}</span></div>
    <h2 style={title}>{o.title}</h2><p style={body}>{o.description}</p>
    <div style={stats}><Stat label="Score" value={`${Math.round(score)}/100`} /><Stat label="Evidence" value={`${Math.round(confidence)}%`} /><Stat label="Personal fit" value={`${Math.round(o.score?.personalFit ?? 0)}/100`} /><Stat label="Startup" value={money(o.economics.startupCost, o.economics.currency)} /><Stat label="Time" value={o.economics.estimatedHours == null ? "—" : `~${o.economics.estimatedHours}h`} /></div>
    <div style={reason}><strong>Why ranked here</strong>{card.rationale.map((r, i) => <div key={i}>· {r}</div>)}</div>
    {o.source.url && <a href={o.source.url} target="_blank" rel="noreferrer" style={source}>Evidence source · {o.source.name} ↗</a>}
    <div style={actions}>{o.status !== "approved" && <button disabled={busy} onClick={onApprove} style={primary}>{busy ? "Working…" : "Approve"}</button>}{!saved && <button onClick={onSave} style={secondary}>Save</button>}<button onClick={onDismiss} style={secondary}>Dismiss</button></div>
    <div style={links}><Link href="/ask-jhadina?surface=opportunities&route=/opportunity" style={link}>Ask Jhadina</Link><Link href="/money/command-center" style={link}>Money</Link><Link href="/campaign/polls" style={link}>CampaignOS</Link><Link href="/director-studio" style={link}>Director Studio</Link></div>
  </article>
}
function Metric({ label, value }: { label: string; value: number }) { return <div><div style={metricValue}>{value}</div><div style={metricLabel}>{label}</div></div> }
function Stat({ label, value }: { label: string; value: string }) { return <div><div style={statLabel}>{label}</div><div style={statValue}>{value}</div></div> }
function formatLabel(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase()) }
function money(value?: number, currency = "USD") { if (value == null || value === 0) return "$0"; return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value) }

const page = { minHeight: "100vh", background: "linear-gradient(180deg,#f5f1ea,#edf2ed 55%,#f3eee8)", color: "#29332e", padding: "28px 18px 110px", fontFamily: 'ui-rounded,"Avenir Next",Avenir,system-ui,sans-serif' }
const wrap = { maxWidth: 860, margin: "0 auto" }
const eyebrow = { fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase" as const, color: "#77847c" }
const h1 = { margin: "12px 0 8px", fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 400 as const, fontSize: "clamp(36px,9vw,58px)", letterSpacing: "-.045em", lineHeight: 1 }
const sub = { margin: 0, color: "#718078", lineHeight: 1.65, maxWidth: 650 }
const metrics = { display: "flex", gap: 38, padding: "26px 2px 16px", overflowX: "auto" as const }
const metricValue = { fontSize: 28, fontFamily: 'Georgia,"Times New Roman",serif' }
const metricLabel = { fontSize: 10, textTransform: "uppercase" as const, letterSpacing: ".14em", color: "#7d8982" }
const filters = { display: "flex", gap: 8, overflowX: "auto" as const, paddingBottom: 18 }
const chip = { border: "1px solid #d5ddd7", borderRadius: 999, background: "rgba(255,255,255,.5)", padding: "9px 14px", color: "#68756e", cursor: "pointer" }
const activeChip = { background: "#29332e", color: "#fff", borderColor: "#29332e" }
const warning = { padding: 14, borderRadius: 16, background: "#f7e8e2", color: "#7a4e45", marginBottom: 18 }
const empty = { padding: 24, borderRadius: 22, border: "1px solid #dce2dd", background: "rgba(255,255,255,.55)", color: "#68756e" }
const cardStyle = { background: "rgba(255,255,255,.72)", border: "1px solid #dce2dd", borderRadius: 26, padding: 22, marginBottom: 16, boxShadow: "0 12px 40px rgba(53,65,58,.06)" }
const topline = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const, fontSize: 10, textTransform: "uppercase" as const, letterSpacing: ".11em", color: "#758179" }
const title = { margin: "12px 0 7px", fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 400 as const, fontSize: 28 }
const body = { margin: 0, color: "#6e7a73", lineHeight: 1.6 }
const stats = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 14, padding: "18px 0 12px" }
const statLabel = { fontSize: 9, textTransform: "uppercase" as const, letterSpacing: ".12em", color: "#8b968f" }
const statValue = { fontSize: 14, fontWeight: 650 as const, color: "#3c4a43", marginTop: 3 }
const reason = { background: "#eef1ed", borderRadius: 17, padding: 14, color: "#657169", fontSize: 12, lineHeight: 1.65 }
const source = { display: "block", marginTop: 12, color: "#657169", fontSize: 12 }
const actions = { display: "flex", gap: 8, marginTop: 15, flexWrap: "wrap" as const }
const primary = { border: 0, borderRadius: 999, background: "#29332e", color: "white", padding: "10px 16px", cursor: "pointer" }
const secondary = { border: "1px solid #d5ddd7", borderRadius: 999, background: "transparent", color: "#536058", padding: "10px 16px", cursor: "pointer" }
const links = { display: "flex", gap: 7, marginTop: 11, flexWrap: "wrap" as const }
const link = { border: "1px solid #e0e5e1", borderRadius: 999, padding: "7px 10px", color: "#68756e", fontSize: 11, textDecoration: "none" }
