"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type {
  SideHustleExperiment,
  SideHustleExperimentEvaluation,
  SideHustleExperimentObservation,
  SideHustleExperimentProposal,
} from "@jhadina/opportunity-core"

type ExperimentRecord = {
  experiment: SideHustleExperiment
  observations: SideHustleExperimentObservation[]
  evaluation?: SideHustleExperimentEvaluation
}

type ObservationDraft = {
  metrics: Record<string, string>
  spend: string
  hours: string
  evidenceRefs: string
  notes: string
}

export default function SideHustleValidationPage({ params }: { params: { id: string } }) {
  const [records, setRecords] = useState<ExperimentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [proposal, setProposal] = useState<SideHustleExperimentProposal | null>(null)
  const [proposalBusy, setProposalBusy] = useState(false)
  const [observationDrafts, setObservationDrafts] = useState<Record<string, ObservationDraft>>({})

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

  async function generateProposal() {
    setProposalBusy(true)
    setError("")
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(params.id)}/experiments/proposal`,
        { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
      )
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Unable to generate validation proposal")
      setProposal(json.data?.proposal ?? null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to generate validation proposal")
    } finally {
      setProposalBusy(false)
    }
  }

  async function createProposal() {
    if (!proposal) return
    setProposalBusy(true)
    setError("")
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(params.id)}/experiments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            hypothesis: proposal.hypothesis,
            targetCustomer: proposal.targetCustomer,
            channel: proposal.channel,
            offer: proposal.offer,
            maxSpend: proposal.maxSpend,
            currency: proposal.currency,
            maxHours: proposal.maxHours,
            maxDurationDays: proposal.maxDurationDays,
            minimumObservations: proposal.minimumObservations,
            successCriteria: proposal.successCriteria,
            killCriteria: proposal.killCriteria,
            evidenceRefs: proposal.evidenceRefs,
          }),
        },
      )
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Unable to create validation plan")
      setProposal(null)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create validation plan")
    } finally {
      setProposalBusy(false)
    }
  }

  function observationDraft(experiment: SideHustleExperiment): ObservationDraft {
    return observationDrafts[experiment.id] ?? {
      metrics: Object.fromEntries(
        [...experiment.successCriteria, ...experiment.killCriteria]
          .map((criterion) => criterion.metric)
          .filter((metric, index, values) => values.indexOf(metric) === index)
          .map((metric) => [metric, ""]),
      ),
      spend: "0",
      hours: "0",
      evidenceRefs: "",
      notes: "",
    }
  }

  function patchObservationDraft(
    experiment: SideHustleExperiment,
    patch: (draft: ObservationDraft) => ObservationDraft,
  ) {
    setObservationDrafts((current) => ({
      ...current,
      [experiment.id]: patch(current[experiment.id] ?? observationDraft(experiment)),
    }))
  }

  async function recordObservation(experiment: SideHustleExperiment) {
    const draft = observationDraft(experiment)
    const metrics = Object.fromEntries(
      Object.entries(draft.metrics).map(([metric, value]) => [metric, Number(value)]),
    )
    if (Object.values(draft.metrics).some((value) => value.trim() === "" || !Number.isFinite(Number(value)))) {
      setError("Every experiment metric needs a numeric observation.")
      return
    }
    const evidenceRefs = draft.evidenceRefs
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean)
    if (evidenceRefs.length === 0) {
      setError("At least one evidence reference is required for every observation.")
      return
    }
    const spend = Number(draft.spend)
    const hours = Number(draft.hours)
    if (
      draft.spend.trim() === "" ||
      draft.hours.trim() === "" ||
      !Number.isFinite(spend) ||
      !Number.isFinite(hours) ||
      spend < 0 ||
      hours < 0
    ) {
      setError("Spend and hours must be explicit non-negative numbers.")
      return
    }

    setBusy(experiment.id)
    setError("")
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(params.id)}/experiments/${encodeURIComponent(experiment.id)}/observations`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            metrics,
            spend,
            hours,
            evidenceRefs,
            notes: draft.notes,
          }),
        },
      )
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Unable to record validation evidence")
      setObservationDrafts((current) => {
        const next = { ...current }
        delete next[experiment.id]
        return next
      })
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record validation evidence")
    } finally {
      setBusy(null)
    }
  }

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

        <div style={proposalBar}>
          <button style={secondary} disabled={proposalBusy} onClick={() => void generateProposal()}>
            {proposalBusy ? "Working…" : proposal ? "Regenerate proposal" : "Generate Jhadina proposal"}
          </button>
          <span style={proposalHint}>Proposal generation never starts outreach or spends money.</span>
        </div>

        {proposal && (
          <article style={proposalCard}>
            <div style={topRow}>
              <span style={badge}>proposal</span>
              <span style={badge}>{proposal.familyLabel}</span>
              <span style={badge}>{proposal.archetype.replace(/_/g, " ")}</span>
            </div>
            <h2 style={cardTitle}>{proposal.hypothesis}</h2>

            <label style={fieldLabel}>
              Target customer
              <input
                style={input}
                value={proposal.targetCustomer}
                onChange={(event) => setProposal({ ...proposal, targetCustomer: event.target.value })}
              />
            </label>
            <label style={fieldLabel}>
              Offer
              <input
                style={input}
                value={proposal.offer}
                onChange={(event) => setProposal({ ...proposal, offer: event.target.value })}
              />
            </label>
            <p style={copy}><strong>Channel:</strong> {proposal.channel}</p>

            <div style={metricGrid}>
              <label style={fieldLabel}>
                Spend cap
                <input
                  style={input}
                  type="number"
                  min={0}
                  max={500}
                  value={proposal.maxSpend}
                  onChange={(event) => setProposal({ ...proposal, maxSpend: Number(event.target.value) })}
                />
              </label>
              <label style={fieldLabel}>
                Hours cap
                <input
                  style={input}
                  type="number"
                  min={1}
                  max={40}
                  value={proposal.maxHours}
                  onChange={(event) => setProposal({ ...proposal, maxHours: Number(event.target.value) })}
                />
              </label>
              <label style={fieldLabel}>
                Duration days
                <input
                  style={input}
                  type="number"
                  min={1}
                  max={45}
                  value={proposal.maxDurationDays}
                  onChange={(event) => setProposal({ ...proposal, maxDurationDays: Number(event.target.value) })}
                />
              </label>
              <Metric label="Min evidence" value={String(proposal.minimumObservations)} />
            </div>

            <div style={section}>
              <div style={sectionTitle}>Suggested success criteria</div>
              {proposal.successCriteria.map((criterion) => (
                <div key={criterion.id} style={criterionRow}>
                  <span>{criterion.metric}</span>
                  <span>{criterion.operator} {criterion.threshold} {criterion.unit}</span>
                </div>
              ))}
            </div>

            <div style={section}>
              <div style={sectionTitle}>Assumptions to review</div>
              {proposal.assumptions.map((assumption) => (
                <div key={assumption} style={assumptionRow}>• {assumption}</div>
              ))}
            </div>

            <div style={actions}>
              <button
                style={primary}
                disabled={proposalBusy || records.some((item) => ["planned", "running"].includes(item.experiment.status))}
                onClick={() => void createProposal()}
              >
                {records.some((item) => ["planned", "running"].includes(item.experiment.status))
                  ? "Finish active experiment first"
                  : proposalBusy ? "Working…" : "Create bounded plan"}
              </button>
            </div>
          </article>
        )}

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

              {experiment.status === "running" && (() => {
                const draft = observationDraft(experiment)
                return (
                  <div style={evidenceCapture}>
                    <div style={sectionTitle}>Record evidence observation</div>
                    <div style={evidenceGrid}>
                      {Object.keys(draft.metrics).map((metric) => (
                        <label key={metric} style={fieldLabel}>
                          {metric.replace(/_/g, " ")}
                          <input
                            style={input}
                            type="number"
                            step="any"
                            value={draft.metrics[metric]}
                            onChange={(event) => patchObservationDraft(experiment, (current) => ({
                              ...current,
                              metrics: { ...current.metrics, [metric]: event.target.value },
                            }))}
                          />
                        </label>
                      ))}
                      <label style={fieldLabel}>
                        Spend used
                        <input
                          style={input}
                          type="number"
                          min={0}
                          step="0.01"
                          value={draft.spend}
                          onChange={(event) => patchObservationDraft(experiment, (current) => ({ ...current, spend: event.target.value }))}
                        />
                      </label>
                      <label style={fieldLabel}>
                        Hours used
                        <input
                          style={input}
                          type="number"
                          min={0}
                          step="0.01"
                          value={draft.hours}
                          onChange={(event) => patchObservationDraft(experiment, (current) => ({ ...current, hours: event.target.value }))}
                        />
                      </label>
                    </div>
                    <label style={fieldLabel}>
                      Evidence references
                      <textarea
                        style={textarea}
                        value={draft.evidenceRefs}
                        placeholder="Paste source URLs or internal evidence IDs, separated by commas or new lines"
                        onChange={(event) => patchObservationDraft(experiment, (current) => ({ ...current, evidenceRefs: event.target.value }))}
                      />
                    </label>
                    <label style={fieldLabel}>
                      Notes
                      <textarea
                        style={textarea}
                        value={draft.notes}
                        placeholder="What happened in this observation?"
                        onChange={(event) => patchObservationDraft(experiment, (current) => ({ ...current, notes: event.target.value }))}
                      />
                    </label>
                    <div style={actions}>
                      <button
                        style={primary}
                        disabled={busy === experiment.id}
                        onClick={() => void recordObservation(experiment)}
                      >
                        {busy === experiment.id ? "Recording…" : "Record observation"}
                      </button>
                    </div>
                  </div>
                )
              })()}

              {observations.length > 0 && (
                <div style={section}>
                  <div style={sectionTitle}>Evidence history</div>
                  {[...observations].reverse().map((observation) => (
                    <div key={observation.id} style={observationRow}>
                      <div>
                        <strong>{new Date(observation.observedAt).toLocaleString()}</strong>
                        {observation.notes ? <div style={observationNote}>{observation.notes}</div> : null}
                        <div style={observationMetrics}>
                          {Object.entries(observation.metrics).map(([metric, value]) => (
                            <span key={metric} style={miniBadge}>{metric.replace(/_/g, " ")}: {value}</span>
                          ))}
                        </div>
                      </div>
                      <div style={observationMeta}>
                        {money(observation.spend, experiment.currency)} · {observation.hours}h · {observation.evidenceRefs.length} evidence ref{observation.evidenceRefs.length === 1 ? "" : "s"}
                      </div>
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
const secondary = { border: "1px solid #d5ddd7", borderRadius: 999, padding: "10px 15px", background: "white", color: "#526158", cursor: "pointer" }
const warning = { marginTop: 16, padding: 12, borderRadius: 14, background: "#f3ebe1", color: "#785f49" }
const proposalBar = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const, marginTop: 18 }
const proposalHint = { color: "#7b877f", fontSize: 11 }
const proposalCard = { ...card, border: "1px solid #cbd8cf", background: "rgba(244,248,244,.92)" }
const fieldLabel = { display: "grid", gap: 5, color: "#69766e", fontSize: 10, textTransform: "uppercase" as const, letterSpacing: ".08em", marginTop: 10 }
const input = { width: "100%", boxSizing: "border-box" as const, border: "1px solid #d2dad4", borderRadius: 10, background: "white", padding: "9px 10px", color: "#34453c", fontSize: 13 }
const assumptionRow = { margin: "5px 0", color: "#5f6d65", fontSize: 12, lineHeight: 1.5 }
const evidenceCapture = { marginTop: 18, padding: 14, borderRadius: 16, background: "#f5f7f4", border: "1px solid #dce4de" }
const evidenceGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }
const textarea = { ...input, minHeight: 72, resize: "vertical" as const, fontFamily: "inherit" }
const observationRow = { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid #e7ebe7", fontSize: 12, color: "#59675f", flexWrap: "wrap" as const }
const observationNote = { marginTop: 4, color: "#6f7b74" }
const observationMetrics = { display: "flex", gap: 6, flexWrap: "wrap" as const, marginTop: 7 }
const miniBadge = { display: "inline-flex", padding: "4px 7px", borderRadius: 999, background: "#edf1ed", fontSize: 10 }
const observationMeta = { color: "#7a867e", fontSize: 11 }
const empty = { marginTop: 20, padding: 22, borderRadius: 20, background: "rgba(255,255,255,.6)", border: "1px solid #dce2dd", color: "#68756e" }
const muted = { marginTop: 20, color: "#7b877f" }
