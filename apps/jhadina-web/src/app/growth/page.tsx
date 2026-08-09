'use client'

import { useEffect, useState } from "react"

type Draft = {
  id: string
  brand: string
  platforms: string[]
  kind: string
  title?: string
  body: string
  rationale: string
  status: string
  suggestedPublishAt?: string
  createdAt: string
}

const brandLabel: Record<string, string> = {
  JHADINA: "Jhadina", JHADINATV: "JhadinaTV", JHADINA_MUSIC: "Jhadina Music",
  OVERAGEOS: "OverageOS", PUPSONSTUFF: "PupsonStuff", ATWOOD_BOOKIE: "Atwood Bookie",
}

export default function GrowthCommandCenter() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [redraftId, setRedraftId] = useState<string | null>(null)
  const [instruction, setInstruction] = useState("")

  async function load() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/growth/drafts", { headers: { "x-jhadina-user-id": "user_demo" } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not load growth drafts")
      setDrafts(json.data?.drafts ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load growth drafts")
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function action(path: string, draftId: string, extra: Record<string, string> = {}) {
    setBusy(draftId); setError("")
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json", "x-jhadina-user-id": "user_demo" },
        body: JSON.stringify({ draftId, ...extra }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Action failed")
      await load()
      return true
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed"); return false }
    finally { setBusy(null) }
  }

  async function redraft() {
    if (!redraftId || !instruction.trim()) return
    const id = redraftId
    const ok = await action("/api/growth/drafts/redraft", id, { instruction: instruction.trim() })
    if (ok) { setRedraftId(null); setInstruction("") }
  }

  const pending = drafts.filter((d) => d.status === "PENDING_APPROVAL")
  const approved = drafts.filter((d) => d.status === "APPROVED")
  const scheduled = drafts.filter((d) => d.status === "SCHEDULED")
  const redraftDraft = drafts.find((d) => d.id === redraftId)

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#f5f1ea,#edf2ed 55%,#f3eee8)", color: "#29332e", padding: "28px 18px 110px", fontFamily: 'ui-rounded,"Avenir Next",Avenir,system-ui,sans-serif' }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "#77847c" }}>Jhadina Growth</div>
        <h1 style={{ margin: "12px 0 8px", fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 400, fontSize: "clamp(36px,9vw,58px)", letterSpacing: "-.045em", lineHeight: 1 }}>Your content, with you in control.</h1>
        <p style={{ margin: 0, color: "#718078", lineHeight: 1.65, maxWidth: 590 }}>Jhadina can find ideas and prepare content. Nothing gets published without your approval.</p>

        <div style={{ display: "flex", gap: 24, overflowX: "auto", padding: "26px 2px 12px", marginBottom: 18 }}>
          <Metric label="Needs you" value={pending.length} />
          <Metric label="Approved" value={approved.length} />
          <Metric label="Scheduled" value={scheduled.length} />
        </div>

        {error && <div role="alert" style={{ marginBottom: 16, padding: 13, borderRadius: 16, background: "#f5e1dc", color: "#8d5148" }}>{error}</div>}
        {loading ? <p style={{ color: "#7b877f" }}>Loading your growth queue…</p> : pending.length === 0 ? (
          <section style={empty}><strong>You’re caught up.</strong><span>When Jhadina has a growth idea worth your attention, it will appear here.</span></section>
        ) : (
          <section>
            <h2 style={heading}>Needs your call</h2>
            {pending.map((draft) => <DraftCard key={draft.id} draft={draft} busy={busy === draft.id} onApprove={() => action("/api/growth/drafts/approve", draft.id)} onReject={() => action("/api/growth/drafts/reject", draft.id)} onRedraft={() => { setRedraftId(draft.id); setInstruction("") }} />)}
          </section>
        )}

        {approved.length > 0 && <section style={{ marginTop: 38 }}><h2 style={heading}>Ready to schedule</h2>{approved.map((draft) => <DraftCard key={draft.id} draft={draft} busy={busy === draft.id} onRedraft={() => { setRedraftId(draft.id); setInstruction("") }} onSchedule={() => action("/api/growth/drafts/schedule", draft.id, { scheduledAt: draft.suggestedPublishAt || new Date(Date.now() + 86400000).toISOString() })} />)}</section>}

        {redraftDraft && <div role="dialog" aria-modal="true" style={modalBackdrop} onClick={() => busy ? null : setRedraftId(null)}>
          <section style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={eyebrow}>Redraft {brandLabel[redraftDraft.brand] || redraftDraft.brand}</div>
            <h2 style={{ margin: "9px 0 7px", fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 400, fontSize: 28 }}>Tell Jhadina what to change.</h2>
            <p style={{ margin: "0 0 14px", color: "#718078", lineHeight: 1.55 }}>The original stays محفوظ. Your instruction creates a new version and sends it back through approval.</p>
            <div style={originalBox}><strong>{redraftDraft.title || "Current draft"}</strong><span>{redraftDraft.body}</span></div>
            <textarea autoFocus value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Make it less robotic and more like me…" style={textarea} rows={5} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button disabled={!!busy} onClick={() => setRedraftId(null)} style={secondary}>Cancel</button>
              <button disabled={!!busy || !instruction.trim()} onClick={() => void redraft()} style={primary}>{busy ? "Redrafting…" : "Create new version"}</button>
            </div>
          </section>
        </div>}
      </div>
    </main>
  )
}

function DraftCard({ draft, busy, onApprove, onReject, onSchedule, onRedraft }: { draft: Draft; busy: boolean; onApprove?: () => void; onReject?: () => void; onSchedule?: () => void; onRedraft?: () => void }) {
  return <article style={{ padding: 20, marginBottom: 12, borderRadius: 25, background: "rgba(255,255,255,.72)", border: "1px solid #dce2dd", boxShadow: "0 14px 38px rgba(67,76,69,.07)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><span style={eyebrow}>{brandLabel[draft.brand] || draft.brand} · {draft.kind}</span><span style={{ ...eyebrow, color: "#8b7b9d" }}>{draft.platforms.join(" · ")}</span></div>
    {draft.title && <h3 style={{ margin: "12px 0 7px", fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 400, fontSize: 24 }}>{draft.title}</h3>}
    <p style={{ margin: "8px 0 14px", fontSize: 15, lineHeight: 1.6 }}>{draft.body}</p>
    <div style={{ padding: 13, borderRadius: 16, background: "#eef1ed", color: "#657169", fontSize: 13, lineHeight: 1.55 }}><strong>Why Jhadina suggested it:</strong> {draft.rationale}</div>
    <div style={{ display: "flex", gap: 8, marginTop: 15, flexWrap: "wrap" }}>
      {onApprove && <button disabled={busy} onClick={onApprove} style={primary}>{busy ? "Working…" : "Approve"}</button>}
      {onReject && <button disabled={busy} onClick={onReject} style={secondary}>Reject</button>}
      {onRedraft && <button disabled={busy} onClick={onRedraft} style={secondary}>Redraft</button>}
      {onSchedule && <button disabled={busy} onClick={onSchedule} style={primary}>{busy ? "Scheduling…" : "Schedule"}</button>}
    </div>
  </article>
}

function Metric({ label, value }: { label: string; value: number }) { return <div style={{ minWidth: 92 }}><div style={{ fontSize: 26, fontFamily: 'Georgia,"Times New Roman",serif' }}>{value}</div><div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".14em", color: "#7d8982" }}>{label}</div></div> }
const heading = { margin: "0 4px 14px", fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 400 as const, fontSize: 26 }
const eyebrow = { fontSize: 10, letterSpacing: ".11em", textTransform: "uppercase" as const, color: "#758179" }
const primary = { border: 0, borderRadius: 999, padding: "10px 17px", background: "#34443c", color: "#f8f6f1", fontWeight: 600, cursor: "pointer" }
const secondary = { border: "1px solid #d4dcd5", borderRadius: 999, padding: "9px 16px", background: "rgba(255,255,255,.5)", color: "#56635c", fontWeight: 600, cursor: "pointer" }
const empty = { display: "flex", flexDirection: "column" as const, gap: 7, padding: 22, borderRadius: 22, background: "rgba(255,255,255,.55)", border: "1px solid #dce2dd", color: "#68756e", lineHeight: 1.5 }
const modalBackdrop = { position: "fixed" as const, inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(38,45,41,.28)", backdropFilter: "blur(8px)" }
const modal = { width: "min(620px,100%)", padding: 24, borderRadius: 28, background: "#faf8f3", border: "1px solid #d9dfda", boxShadow: "0 24px 80px rgba(36,45,40,.22)" }
const originalBox = { display: "flex", flexDirection: "column" as const, gap: 6, padding: 14, borderRadius: 17, background: "#eef1ed", color: "#59655e", fontSize: 13, lineHeight: 1.5 }
const textarea = { width: "100%", boxSizing: "border-box" as const, marginTop: 12, padding: 15, borderRadius: 17, border: "1px solid #d4dcd5", background: "white", color: "#29332e", font: "inherit", lineHeight: 1.5, outline: "none", resize: "vertical" as const }
