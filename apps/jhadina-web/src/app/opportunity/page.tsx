"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { rankSideIncomeOpportunities } from "@/lib/opportunities/sideIncome"
import type { AutomationLevel, Opportunity, OpportunityKind } from "@/lib/opportunities/sideIncome"

const KIND_LABEL: Record<OpportunityKind, string> = {
  pod: "Print on Demand",
  dropshipping: "Dropshipping",
  ai_job: "AI Job",
  remote_gig: "Remote Gig",
  freelance: "Freelance",
  creator: "Creator",
  affiliate: "Affiliate",
  automation: "Automation",
  overage: "Unclaimed property",
}

const AUTOMATION_LABEL: Record<AutomationLevel, string> = {
  ai_can_do_it: "AI can do this",
  ai_plus_user: "AI + you",
  user_led: "You lead",
  do_not_pursue: "Not recommended",
}

type FilterKind = "all" | "pod" | "dropshipping" | "ai_job" | "remote_gig" | "freelance" | "creator" | "automation"

const FILTERS: { id: FilterKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pod", label: "POD" },
  { id: "dropshipping", label: "Dropshipping" },
  { id: "ai_job", label: "AI jobs" },
  { id: "remote_gig", label: "Remote" },
  { id: "freelance", label: "Freelance" },
  { id: "creator", label: "Creator" },
  { id: "automation", label: "Automation" },
]

// "Best match" and "deadline approaching" are display thresholds, not part
// of the Opportunity contract itself - tune here without touching the model.
const BEST_MATCH_FIT_SCORE = 80
const DEADLINE_SOON_MS = 7 * 24 * 60 * 60 * 1000

export default function OpportunityCommandCenter() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKind>("all")
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  async function load() {
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/opportunities", { headers: { "x-jhadina-user-id": "user_demo" }, cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not load opportunities")
      setOpportunities(rankSideIncomeOpportunities(json.data?.opportunities ?? []))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load opportunities")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  async function approve(id: string) {
    setBusy(id); setError("")
    try {
      const res = await fetch("/api/opportunities/approve", {
        method: "POST",
        headers: { "content-type": "application/json", "x-jhadina-user-id": "user_demo" },
        body: JSON.stringify({ opportunityId: id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not approve this opportunity")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not approve this opportunity")
    } finally {
      setBusy(null)
    }
  }

  // Save/Dismiss are lightweight triage with no external effect, so they
  // stay as local UI state instead of round-tripping to the server.
  function save(id: string) {
    setSavedIds((prev) => new Set(prev).add(id))
  }
  function dismiss(id: string) {
    setDismissedIds((prev) => new Set(prev).add(id))
  }

  const undismissed = useMemo(() => opportunities.filter((o) => !dismissedIds.has(o.id)), [opportunities, dismissedIds])
  const visible = useMemo(
    () => undismissed.filter((o) => filter === "all" || o.kind === filter),
    [undismissed, filter]
  )

  const needsReview = visible.filter((o) => o.status === "new" && !savedIds.has(o.id))
  const saved = visible.filter((o) => o.status === "new" && savedIds.has(o.id))
  const approved = visible.filter((o) => o.status === "approved")

  const summary = useMemo(() => {
    const now = Date.now()
    const soon = now + DEADLINE_SOON_MS
    return {
      found: undismissed.length,
      bestMatches: undismissed.filter((o) => o.fitScore >= BEST_MATCH_FIT_SCORE).length,
      aiCanDoIt: undismissed.filter((o) => o.automationLevel === "ai_can_do_it").length,
      aiPlusUser: undismissed.filter((o) => o.automationLevel === "ai_plus_user").length,
      deadlinesApproaching: undismissed.filter((o) => {
        if (!o.deadline) return false
        const t = new Date(o.deadline).getTime()
        return Number.isFinite(t) && t >= now && t <= soon
      }).length,
      needsReview: undismissed.filter((o) => o.status === "new").length,
    }
  }, [undismissed])

  return (
    <main style={page}>
      <div style={wrap}>
        <div style={eyebrow}>Jhadina Growth</div>
        <h1 style={h1}>Opportunities, on your terms.</h1>
        <p style={sub}>Jhadina finds and ranks side-income opportunities for you to review. It never applies for a job, spends money, or publishes a listing without your approval.</p>

        <div style={metricsRow}>
          <Metric label="Found" value={summary.found} />
          <Metric label="Best matches" value={summary.bestMatches} />
          <Metric label="AI can do it" value={summary.aiCanDoIt} />
          <Metric label="AI + you" value={summary.aiPlusUser} />
          <Metric label="Deadlines soon" value={summary.deadlinesApproaching} />
          <Metric label="Needs review" value={summary.needsReview} />
        </div>

        <div style={filterRow}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              style={{ ...filterChip, ...(filter === f.id ? filterChipActive : {}) }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && <div role="alert" style={warning}>{error}</div>}

        {loading ? (
          <p style={{ color: "#7b877f" }}>Loading opportunities…</p>
        ) : (
          <>
            <section>
              <h2 style={heading}>Needs your review</h2>
              {needsReview.length === 0 ? (
                <Empty text="Jhadina hasn't surfaced anything new matching this filter." />
              ) : (
                needsReview.map((o) => (
                  <OpportunityCard
                    key={o.id}
                    opportunity={o}
                    busy={busy === o.id}
                    onApprove={() => approve(o.id)}
                    onSave={() => save(o.id)}
                    onDismiss={() => dismiss(o.id)}
                  />
                ))
              )}
            </section>

            {saved.length > 0 && (
              <section style={{ marginTop: 38 }}>
                <h2 style={heading}>Saved for later</h2>
                {saved.map((o) => (
                  <OpportunityCard
                    key={o.id}
                    opportunity={o}
                    busy={busy === o.id}
                    onApprove={() => approve(o.id)}
                    onDismiss={() => dismiss(o.id)}
                  />
                ))}
              </section>
            )}

            {approved.length > 0 && (
              <section style={{ marginTop: 38 }}>
                <h2 style={heading}>Approved</h2>
                {approved.map((o) => (
                  <OpportunityCard key={o.id} opportunity={o} busy={false} approved />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function OpportunityCard({
  opportunity, busy, approved, onApprove, onSave, onDismiss,
}: {
  opportunity: Opportunity
  busy: boolean
  approved?: boolean
  onApprove?: () => void
  onSave?: () => void
  onDismiss?: () => void
}) {
  return (
    <article style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={eyebrowSmall}>{KIND_LABEL[opportunity.kind]} · {opportunity.sourceName}</span>
        <span style={{ ...eyebrowSmall, color: "#8b7b9d" }}>Fit {opportunity.fitScore}/100</span>
      </div>

      <h3 style={cardTitle}>{opportunity.title}</h3>
      <p style={cardBody}>{opportunity.summary}</p>

      <div style={statRow}>
        <Stat label="Est. pay" value={formatPay(opportunity.estimatedPay)} />
        <Stat label="Time" value={formatHours(opportunity.estimatedHours)} />
        <Stat label="Startup cost" value={formatCost(opportunity.startupCost)} />
        <Stat label="Deadline" value={formatDeadline(opportunity.deadline)} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <span style={automationBadge}>{AUTOMATION_LABEL[opportunity.automationLevel]}</span>
        {opportunity.riskFlags.map((flag) => (
          <span key={flag} style={riskBadge}>⚠ {flag}</span>
        ))}
      </div>

      <div style={{ padding: 13, borderRadius: 16, background: "#eef1ed", color: "#657169", fontSize: 12, marginTop: 14 }}>
        <a href={opportunity.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "#657169" }}>View source ↗</a>
      </div>

      {approved ? (
        <div style={approvedBadge}>✓ Approved{opportunity.approvedAt ? ` · ${new Date(opportunity.approvedAt).toLocaleDateString()}` : ""}</div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 15, flexWrap: "wrap" }}>
          {onApprove && <button disabled={busy} onClick={onApprove} style={primary}>{busy ? "Working…" : "Approve"}</button>}
          {onSave && <button disabled={busy} onClick={onSave} style={secondary}>Save</button>}
          {onDismiss && <button disabled={busy} onClick={onDismiss} style={secondary}>Dismiss</button>}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        <Link href="/ask-jhadina?surface=opportunities&route=/opportunity" style={linkChip}>Ask Jhadina</Link>
        <Link href="/money/command-center" style={linkChip}>Send to Money</Link>
        <Link href="/campaign/polls" style={linkChip}>Send to CampaignOS</Link>
        <Link href="/director-studio" style={linkChip}>Send to Director Studio</Link>
      </div>
    </article>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 110 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", color: "#8b968f" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 650, color: "#3c4a43" }}>{value}</div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ minWidth: 92 }}>
      <div style={{ fontSize: 26, fontFamily: 'Georgia,"Times New Roman",serif' }}>{value}</div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".14em", color: "#7d8982" }}>{label}</div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: 20, borderRadius: 20, background: "rgba(255,255,255,.55)", border: "1px solid #dce2dd", color: "#68756e" }}>{text}</div>
}

function formatPay(pay?: Opportunity["estimatedPay"]): string {
  if (!pay || (pay.min == null && pay.max == null)) return "Not specified"
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: pay.currency || "USD", maximumFractionDigits: 0 }).format(n)
  const range = pay.min != null && pay.max != null && pay.min !== pay.max
    ? `${fmt(pay.min)}–${fmt(pay.max)}`
    : fmt(pay.max ?? pay.min ?? 0)
  const cadence = pay.cadence && pay.cadence !== "unknown" ? ` / ${pay.cadence.replace("_", " ")}` : ""
  return `${range}${cadence}`
}

function formatHours(hours?: number): string {
  if (hours == null) return "Not specified"
  return `~${hours} hr${hours === 1 ? "" : "s"}`
}

function formatCost(cost?: number): string {
  if (cost == null || cost === 0) return "No startup cost"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cost)
}

function formatDeadline(deadline?: string): string {
  if (!deadline) return "No deadline"
  const t = new Date(deadline)
  if (Number.isNaN(t.getTime())) return "No deadline"
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

const page = { minHeight: "100vh", background: "linear-gradient(180deg,#f5f1ea,#edf2ed 55%,#f3eee8)", color: "#29332e", padding: "28px 18px 110px", fontFamily: 'ui-rounded,"Avenir Next",Avenir,system-ui,sans-serif' }
const wrap = { maxWidth: 860, margin: "0 auto" }
const eyebrow = { fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase" as const, color: "#77847c" }
const eyebrowSmall = { fontSize: 10, letterSpacing: ".11em", textTransform: "uppercase" as const, color: "#758179" }
const h1 = { margin: "12px 0 8px", fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 400 as const, fontSize: "clamp(36px,9vw,58px)", letterSpacing: "-.045em", lineHeight: 1 }
const sub = { margin: 0, color: "#718078", lineHeight: 1.65, maxWidth: 620 }
const metricsRow = { display: "flex", gap: 24, overflowX: "auto" as const, padding: "26px 2px 4px", marginBottom: 10 }
const filterRow = { display: "flex", gap: 8, overflowX: "auto" as const, padding: "6px 2px 22px", flexWrap: "wrap" as const }
const filterChip = { border: "1px solid #d5ddd7", background: "rgba(255,255,255,.5)", borderRadius: 999, padding: "8px 12px", color: "#66736b", cursor: "pointer" }
const filterChipActive = { background: "#34453c", color: "white", borderColor: "#34453c" }
const heading = { margin: "24px 0 12px", fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 400 as const, fontSize: 28 }
const card = { background: "rgba(255,255,255,.78)", border: "1px solid #dce2dd", borderRadius: 24, padding: 20, marginBottom: 12, boxShadow: "0 10px 40px rgba(63,76,67,.05)" }
const cardTitle = { margin: "10px 0 6px", fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 400 as const, fontSize: 25 }
const cardBody = { margin: 0, color: "#657169", lineHeight: 1.6, fontSize: 13 }
const statRow = { display: "flex", gap: 20, overflowX: "auto" as const, marginTop: 18, paddingBottom: 2 }
const automationBadge = { display: "inline-flex", padding: "6px 9px", borderRadius: 999, background: "#e6eee8", color: "#52635a", fontSize: 11 }
const riskBadge = { display: "inline-flex", padding: "6px 9px", borderRadius: 999, background: "#f3ebe1", color: "#84694f", fontSize: 11 }
const primary = { border: 0, borderRadius: 999, padding: "10px 15px", background: "#34453c", color: "white", cursor: "pointer" }
const secondary = { border: "1px solid #d5ddd7", borderRadius: 999, padding: "10px 15px", background: "white", color: "#526158", cursor: "pointer" }
const linkChip = { display: "inline-block", padding: "7px 9px", borderRadius: 999, background: "#f0f3f0", color: "#647169", textDecoration: "none", fontSize: 11 }
const approvedBadge = { marginTop: 15, padding: "10px 12px", borderRadius: 14, background: "#e6eee8", color: "#52635a", fontSize: 12 }
const warning = { padding: 12, borderRadius: 14, background: "#f3ebe1", color: "#785f49", marginBottom: 12 }
