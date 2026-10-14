import Link from "next/link"

export const revalidate = 300

type Entry = { name: string; type: string }
type Market = { market: string; status: string }
type FeedHealth = { requested: number; fetched: number; fixtures: number; provider_errors: number; status: string }
type RunReport = {
  run_id: string
  completed_at_utc: string
  execution_trigger?: "schedule" | "push" | "workflow_dispatch" | "unknown"
  discovered_fixtures: number
  research_forecasts_created: number
  preliminary_grades_created: number
  market_coverage?: Market[]
  sport_coverage?: string[]
  coherence_flags?: unknown[]
  provider_health?: Record<string, FeedHealth>
  diagnostics?: {
    fetched: number
    requested: number
    error_count: number
    overdue_12h_without_verification?: number
    conflicting_provider_events?: number
  }
  placed_bets: number
  virtual_bankroll_usd: number
  official_settlements: number
  market_quotes: number
}
type ScoreMetrics = {
  forecasts: string | null
  graded: string | null
  awaiting: string | null
  accuracy: string | null
  brier: string | null
  reference: string | null
  skill: string | null
  ece: string | null
  duplicates: string | null
  calibration: string | null
}

const ROOT = "https://api.github.com/repos/bookieandco/crispy-waddle/contents/training/sports/paper-ledger/week001"
const RAW = "https://raw.githubusercontent.com/bookieandco/crispy-waddle/main/training/sports/paper-ledger/week001"
const BROWSER = "https://github.com/bookieandco/crispy-waddle/tree/main/training/sports/paper-ledger/week001"
const ACTIONS = "https://github.com/bookieandco/crispy-waddle/actions/workflows/jhadina-sports-lab-week001.yml"
const FIRST_SCHEDULED_RUN = "https://github.com/bookieandco/crispy-waddle/actions/runs/38580588806"

async function entries(folder: string): Promise<Entry[]> {
  try {
    const response = await fetch(ROOT + "/" + folder + "?ref=main", {
      next: { revalidate: 300 },
      headers: { Accept: "application/vnd.github+json" }
    })
    if (!response.ok) return []
    const data: unknown = await response.json()
    return Array.isArray(data) ? data.filter(
      (value: unknown): value is Entry =>
        Boolean(value) && typeof value === "object" &&
        typeof (value as Entry).name === "string" && (value as Entry).type === "file"
    ) : []
  } catch { return [] }
}

async function getSourceFile(path: string): Promise<string | null> {
  try {
    const response = await fetch(RAW + "/" + path, { next: { revalidate: 300 } })
    return response.ok ? response.text() : null
  } catch { return null }
}

function latestRunName(list: Entry[]): string | null {
  const files = list.map(value => value.name)
    .filter(value => /^\d{8,20}-\d{1,4}\.json$/.test(value))
    .sort((a, b) => Number(b.split("-")[0]) - Number(a.split("-")[0]))
  return files[0] ?? null
}

async function latestEvidence(list: Entry[]): Promise<{ report: RunReport; summary: string | null } | null> {
  const file = latestRunName(list)
  if (!file) return null
  const id = file.slice(0, -5)
  const [runBody, summary] = await Promise.all([
    getSourceFile("runs/" + file),
    getSourceFile("summaries/" + id + ".md")
  ])
  if (!runBody) return null
  try {
    const report = JSON.parse(runBody) as RunReport
    if (report?.run_id !== id || report.placed_bets !== 0 ||
      report.virtual_bankroll_usd !== 3100 || report.official_settlements !== 0 ||
      report.market_quotes !== 0 || typeof report.completed_at_utc !== "string") return null
    return { report, summary }
  } catch { return null }
}

function metric(markdown: string | null, label: string): string | null {
  if (!markdown) return null
  const prefix = "- " + label + ": **"
  const line = markdown.split("\n").find(value => value.startsWith(prefix))
  return line ? line.slice(prefix.length).split("**")[0] : null
}

function metrics(markdown: string | null): ScoreMetrics {
  return {
    forecasts: metric(markdown, "Sealed forecasts"),
    graded: metric(markdown, "Preliminary scored"),
    awaiting: metric(markdown, "Events started, awaiting provisional result"),
    accuracy: metric(markdown, "Overall winner accuracy"),
    brier: metric(markdown, "Mean multiclass Brier"),
    reference: metric(markdown, "Mean reference Brier (uniform outcomes)"),
    skill: metric(markdown, "Provisional Brier skill vs reference"),
    ece: metric(markdown, "Expected calibration error"),
    duplicates: metric(markdown, "Repeated identical-result receipts counted once"),
    calibration: metric(markdown, "Calibration readiness")
  }
}

function percentage(value: string | null): string {
  if (!value || value === "—") return "—"
  const number = Number(value)
  return Number.isFinite(number) ? (number * 100).toFixed(1) + "%" : "—"
}

function fmt(value: string | null): string {
  return value && value !== "—" ? value : "—"
}

const names: Record<string, string> = {
  winner: "Winner", spread: "Spread", game_total: "Game total",
  player_props: "Player props", period_props: "Period props",
  touchdowns_or_scorers: "Touchdowns / scorers"
}

export default async function SportsLabPage() {
  const [forecasts, runs, grades, summaries] = await Promise.all([
    entries("forecasts"), entries("runs"), entries("preliminary"), entries("summaries")
  ])
  const evidence = await latestEvidence(runs)
  const latest = evidence?.report ?? null
  const scored = metrics(evidence?.summary ?? null)
  const skill = scored.skill === null || scored.skill === "—" ? null : Number(scored.skill)
  const quality = skill === null || !Number.isFinite(skill) ? "Awaiting scored evidence" :
    skill <= 0 ? "Below simple reference on current sample" : "Above simple reference on current sample; not validated"
  const parseExclusions = latest?.provider_health
    ? Object.values(latest.provider_health).reduce((sum, feed) => sum + (feed.provider_errors || 0), 0)
    : null
  const runLink = latest && /^\d{8,20}-\d{1,4}$/.test(latest.run_id)
    ? BROWSER.replace("/tree/main/", "/blob/main/") + "/summaries/" + latest.run_id + ".md" : null
  const pacific = latest ? new Date(latest.completed_at_utc).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short"
  }) : "Unknown"

  return <main className="jh-page">
    <div className="jh-wrap">
      <p className="jh-eyebrow">Jhadina · Capital Lab · Paper research</p>
      <h1 className="jh-title">Sports Lab</h1>
      <p className="jh-copy">Week 001 · October 13–20, 2026. Uncalibrated research
        predictions across eight sports. No real wagering, bookmaker odds, official
        settlements, or automatic training-weight updates.</p>
      <div className="jh-row" style={{ marginTop: 16 }}>
        <span className={latest ? "jh-status jh-status--success" : "jh-status jh-status--warning"}>
          {latest ? "Append-only research ledger active" : "Latest run unavailable"}
        </span>
        <span className="jh-status">Paper only · $3,100 virtual · $0 staked</span>
      </div>

      <div className="jh-grid">
        <article className="jh-card jh-card--third">
          <div className="jh-metric">{fmt(scored.forecasts)}</div>
          <p className="jh-label">Sealed forecasts</p>
        </article>
        <article className="jh-card jh-card--third">
          <div className="jh-metric">{fmt(scored.graded)}</div>
          <p className="jh-label">Distinct games graded</p>
        </article>
        <article className="jh-card jh-card--third">
          <div className="jh-metric">{percentage(scored.accuracy)}</div>
          <p className="jh-label">Winner accuracy · preliminary</p>
        </article>
        <article className="jh-card jh-card--third">
          <div className="jh-metric">{fmt(scored.awaiting)}</div>
          <p className="jh-label">Started events awaiting grade</p>
        </article>
        <article className="jh-card jh-card--third">
          <div className="jh-metric">{fmt(scored.brier)}</div>
          <p className="jh-label">Mean Brier · lower is better</p>
        </article>
        <article className="jh-card jh-card--third">
          <div className="jh-metric">{fmt(scored.reference)}</div>
          <p className="jh-label">Simple reference Brier</p>
        </article>

        <article className="jh-card jh-card--wide">
          <h2 className="jh-card-title">Prediction-quality audit</h2>
          <p className="jh-card-copy"><strong>{quality}.</strong></p>
          <p className="jh-card-copy">
            Research Brier skill versus reference: {fmt(scored.skill)} ·
            Calibration error: {fmt(scored.ece)}.
          </p>
          <p className="jh-card-copy">
            Repeated final-score receipts counted once: {fmt(scored.duplicates)} ·
            Total receipt files: {grades.length}. Grading is preliminary,
            and neither a profitable strategy nor a licensed market edge is established.
          </p>
          <p className="jh-card-copy">
            Calibration readiness: {fmt(scored.calibration)}.
            Predictions remain frozen after game start.
          </p>
        </article>

        <article className="jh-card jh-card--wide">
          <h2 className="jh-card-title">Latest cloud collection</h2>
          {latest ? <div>
            <p className="jh-card-copy">Run {latest.run_id} · {pacific} Pacific · Trigger:
              {" "}{latest.execution_trigger === "schedule" ? "Automatic schedule" :
                latest.execution_trigger === "push" ? "Code push" :
                latest.execution_trigger === "workflow_dispatch" ? "Manual" : "Not recorded"}
            </p>
            <p className="jh-card-copy">
              {latest.research_forecasts_created} new forecasts ·
              {" "}{latest.preliminary_grades_created} new provisional grade receipts ·
              {" "}{runs.length} stored run receipts.
            </p>
            <p className="jh-card-copy">
              Successful feed requests: {latest.diagnostics?.fetched ?? "?"}/
              {latest.diagnostics?.requested ?? "?"} ·
              Parsed-event exclusions: {parseExclusions ?? "?"} ·
              Conflicting source events: {latest.diagnostics?.conflicting_provider_events ?? "?"}.
            </p>
            <p className="jh-card-copy">
              Results overdue 12+ hours: {latest.diagnostics?.overdue_12h_without_verification ?? "?"} ·
              Model signal disagreements: {latest.coherence_flags?.length ?? 0}.
            </p>
            <p className="jh-card-copy">
              Sports observed in latest feed: {(latest.sport_coverage ?? []).join(", ") || "Unknown"}.
            </p>
            <p className="jh-card-copy">
              The first automatic scheduled run was independently recorded on October 14.
              <a href={FIRST_SCHEDULED_RUN} target="_blank" rel="noopener noreferrer"> View the scheduled execution.</a>
            </p>
          </div> : <p className="jh-card-copy">
            No readable paper-only run report is available. Open GitHub Actions
            before interpreting this as a collection failure.
          </p>}
        </article>

        <article className="jh-card jh-card--wide">
          <h2 className="jh-card-title">Six-market admission</h2>
          <div className="jh-list">
            {latest?.market_coverage?.length ? latest.market_coverage.map(item =>
              <div key={item.market} className="jh-item jh-between">
                <strong>{names[item.market] ?? item.market}</strong>
                <span className="jh-status jh-status--warning">
                  {item.status.replaceAll("_", " ").toLowerCase()}
                </span>
              </div>
            ) : <p className="jh-card-copy">
              There is no verified licensed market-quote provider. All betting-market comparisons remain blocked.
            </p>}
          </div>
        </article>

        <article className="jh-card jh-card--wide">
          <h2 className="jh-card-title">Owner controls · iPhone</h2>
          <p className="jh-card-copy">
            GitHub performs the scheduled research even when your phone is off.
            The full report stays in GitHub; the website reads public, paper-only evidence.
          </p>
          <div className="jh-row" style={{ marginTop: 14 }}>
            {runLink && evidence?.summary &&
              <a className="jh-button jh-button--primary" href={runLink}
                target="_blank" rel="noopener noreferrer">Latest scored report</a>}
            <a className="jh-button" href={ACTIONS} target="_blank" rel="noopener noreferrer">Cloud runs</a>
            <a className="jh-button" href={BROWSER + "/summaries"} target="_blank"
              rel="noopener noreferrer">All scorecards</a>
            <a className="jh-button" href={BROWSER + "/forecasts"} target="_blank"
              rel="noopener noreferrer">Sealed forecasts</a>
            <Link className="jh-button" href="/money/command-center">Money Core</Link>
          </div>
        </article>
      </div>
      <p className="jh-meta" style={{ marginTop: 24 }}>
        Read-only evidence snapshot refreshed approximately every five minutes.
        Third-party sports data is not independently verified or licensed for market settlement.
        Absence of source data is not evidence that an event finished or failed.
      </p>
    </div>
  </main>
}
