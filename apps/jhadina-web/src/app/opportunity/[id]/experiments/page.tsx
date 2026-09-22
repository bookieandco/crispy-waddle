"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type {
  SideHustleExperiment,
  SideHustleExperimentEvaluation,
  SideHustleExperimentObservation,
} from "@jhadina/opportunity-core"

type ExperimentRecord = {
  experiment: SideHustleExperiment
  observations: SideHustleExperimentObservation[]
  evaluation?: SideHustleExperimentEvaluation
}

export default function SideHustleValidationPage({ params }: { params: { id: string } }) {
  const [records, setRecords] = useState<ExperimentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function load() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/opportunities/${encodeURIComponent(params.id)}/experiments`, { cache: "no-store" })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Unable to load validation experiments")
      setRecords(json.data?.experiments ?? [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load validation experiments")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [params.id])

  async function transition(experimentId: string, action: "start" | "complete") {
    setBusy(experimentId)
    setError("")
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(params.id)}/experiments/${encodeURIComponent(experimentId)}/${action}`,
        { method: "POST" },
      )
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || `Unable to ${action} experiment`)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to ${action} experiment`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <main style={page}>
      <div style={wrap}>
        <Link href="/opportunity" style={back}>← Opportunities</Link>
        <div style={eyebrow}>Business Factory</div>
        <h1 style={heading}>Validation lab</h1>
        <p style={sub}>
          Bounded experiments test whether a real market pays for the outcome. A “promote” result strengthens the evidence case; it never authorizes spending, outreach, publishing, procurement, bidding, or trading.
        </p>

        {error && <div role="alert" style={warning}>{error}</div>}

        {loading ? (
          <p style={muted}>Loading validation evidence…</p>
        ) : records.length === 0 ? (
          <div style={empty}>
            No validation experiment has been planned for this opportunity yet.
          </div>
        ) : (
          records.map(({ experiment, observations, evaluation }) => (
            <article key={experiment.id} style={card}>
              <div style={topRow}>
                <span style={badge}>{experiment.status}</span>
                <span style={badge}>{experiment.profile.family.replace(/_/g, " ")}</span>
                {evaluation && <span style={decisionBadge(evaluation.decision)}>{evaluation.decision.replace(/_/g, " ")}</span>}
              </div>

              <h2 style={cardTitle}>{experiment.hypothesis}</h2>
              <p style={copy}><strong>Customer:</strong> {experiment.targetCustomer}</p>
              <p style={copy}><strong>Offer:</strong> {experiment.offer}</p>
              <p style={copy}><strong>Channel:</strong> {experiment.channel}</p>

              <div style={metricGrid}>
                <Metric label="Spend cap" value={money(experiment.maxSpend, experiment.currency)} />
                <Metric label="Hours cap" value={`${experiment.maxHours}h`} />
                <Metric label="Duration" value={`${experiment.maxDurationDays}d`} />
                <Metric label="Min evidence" value={String(experiment.minimumObservations)} />
                <Metric label="Observed" value={String(observations.length)} />
                <Metric label="Spend used" value={money(evaluation?.totalSpend ?? sum(observations.map((item) => item.spend)), experiment.currency)} />
                <Metric label="Hours used" value={`${evaluation?.totalHours ?? sum(observations.map((item) => item.hours))}h`} />
              </div>

              <div style={section}>
                <div style={sectionTitle}>Success criteria</div>
                {experiment.successCriteria.map((criterion) => (
                  <div key={criterion.id} style={criterionRow}>
                    <span>{criterion.metric}</span>
                    <span>{criterion.operator} {criterion.threshold} {criterion.unit}</span>
                  </div>
                ))}
              </div>

              {experiment.killCriteria.length > 0 && (
                <div style={section}>
                  <div style={sectionTitle}>Kill criteria</div>
                  {experiment.killCriteria.map((criterion) => (
                    <div key={criterion.id} style={criterionRow}>
                      <span>{criterion.metric}</span>
                      <span>{criterion.operator} {criterion.threshold} {criterion.unit}</span>
                    </div>
                  ))}
                </div>
              )}

              {evaluation && (
                <div style={evaluationBox}>
                  <div style={sectionTitle}>Current evaluation</div>
                  {evaluation.reasons.map((reason) => <div key={reason}>• {reason}</div>)}
                  <div style={{ marginTop: 8 }}>
                    Evidence refs: {evaluation.evidenceRefs.length}
                  </div>
                </div>
              )}

              <div style={actions}>
                {experiment.status === "planned" && (
                  <button
                    style={primary}
                    disabled={busy === experiment.id}
                    onClick={() => void transition(experiment.id, "start")}
                  >
                    {busy === experiment.id ? "Working…" : "Start validation clock"}
                  </button>
                )}
                {experiment.status === "running" && (
                  <button
                    style={primary}
                    disabled={busy === experiment.id}
                    onClick={() => void transition(experiment.id, "complete")}
                  >
                    {busy === experiment.id ? "Working…" : "Close & evaluate"}
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
    </div>
  )
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function sum(values: number[]) {
  return Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100
}

function decisionBadge(decision: SideHustleExperimentEvaluation["decision"]) {
  const background =
    decision === "promote" ? "#dfeee4" :
    decision === "kill" ? "#f3dfdc" :
    decision === "iterate" ? "#efe7d5" : "#e7e9ed"
  return { ...badge, background }
}

const page = { minHeight: "100vh", padding: "28px 18px 100px", background: "linear-gradient(180deg,#f5f1ea,#edf2ed)", color: "#29332e", fontFamily: 'ui-rounded,"Avenir Next",Avenir,system-ui,sans-serif' }
const wrap = { maxWidth: 860, margin: "0 auto" }
const back = { color: "#647169", textDecoration: "none", fontSize: 12 }
const eyebrow = { marginTop: 24, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase" as const, color: "#77847c" }
const heading = { margin: "8px 0", fontFamily: 'Georgia,"Times New Roman",serif', fontSize: "clamp(36px,8vw,56px)", fontWeight: 400 as const, letterSpacing: "-.04em" }
const sub = { maxWidth: 700, color: "#6f7b74", lineHeight: 1.6 }
const card = { marginTop: 18, padding: 20, borderRadius: 24, background: "rgba(255,255,255,.8)", border: "1px solid #dce2dd" }
const topRow = { display: "flex", flexWrap: "wrap" as const, gap: 8 }
const badge = { display: "inline-flex", padding: "6px 9px", borderRadius: 999, background: "#e7ece8", color: "#536158", fontSize: 11, textTransform: "capitalize" as const }
const cardTitle = { margin: "14px 0 10px", fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 400 as const, fontSize: 25 }
const copy = { margin: "4px 0", color: "#5f6d65", lineHeight: 1.5, fontSize: 13 }
const metricGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 14, marginTop: 18, padding: 14, borderRadius: 16, background: "#eef1ed" }
const metricLabel = { fontSize: 9, textTransform: "uppercase" as const, letterSpacing: ".12em", color: "#859087" }
const metricValue = { marginTop: 4, fontSize: 16, fontWeight: 650 as const }
const section = { marginTop: 16 }
const sectionTitle = { fontSize: 10, textTransform: "uppercase" as const, letterSpacing: ".12em", color: "#7a867e", marginBottom: 8 }
const criterionRow = { display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid #e7ebe7", fontSize: 12, color: "#59675f" }
const evaluationBox = { marginTop: 16, padding: 14, borderRadius: 16, background: "#f0f2ef", fontSize: 12, color: "#58665e", lineHeight: 1.55 }
const actions = { display: "flex", gap: 8, marginTop: 16 }
const primary = { border: 0, borderRadius: 999, padding: "10px 15px", background: "#34453c", color: "white", cursor: "pointer" }
const warning = { marginTop: 16, padding: 12, borderRadius: 14, background: "#f3ebe1", color: "#785f49" }
const empty = { marginTop: 20, padding: 22, borderRadius: 20, background: "rgba(255,255,255,.6)", border: "1px solid #dce2dd", color: "#68756e" }
const muted = { marginTop: 20, color: "#7b877f" }
