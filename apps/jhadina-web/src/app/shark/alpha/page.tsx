"use client"

import { useMemo, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { parsePublicAlphaStudy, type AlphaPublicView } from "@/lib/shark/public-alpha-study-view"
import { PhantomWalletCard } from "@/app/money/command-center/phantom-wallet-card"

const descriptions: Record<string, string> = {
  UNSCORED_OPEN: "Awaiting a valid 24–30h same-pool follow-up",
  PRE_HORIZON_OBSERVATION: "Early observation — not scored",
  PRICE_ONLY_UNVERIFIED: "Price-only observation — NOT an executable return",
  PAIR_SWITCH_CENSORED: "Pair switched — comparison censored",
  HORIZON_MISSED_CENSORED: "Follow-up missed the research horizon",
  MISSING_OR_INVALID_EVIDENCE_CENSORED: "Insufficient public evidence",
}
const pct = (v: number | null) => v === null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(2) + "%"
const time = (v: string) => new Date(v).toLocaleString("en-US", {
  timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short",
})

function Trend({ view }: { view: AlphaPublicView }) {
  const data = view.series
  const coordinates = useMemo(() => {
    if (!data.length) return []
    const vals = data.map(d => d.priceUsd)
    const lo = Math.min(...vals), hi = Math.max(...vals)
    return data.map((d, i) => ({
      x: data.length === 1 ? 280 : 16 + i * 528 / (data.length - 1),
      y: hi === lo ? 74 : 132 - (d.priceUsd - lo) * 116 / (hi - lo),
    }))
  }, [data])
  const points = coordinates.map(p => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ")
  return <article className="jh-card">
    <h2 style={{fontSize: 18}}>Public-market price observations</h2>
    <svg role="img" viewBox="0 0 560 148" style={{width: "100%", height: 160}}
      aria-label="Unverified observed USD prices, not actual filled trades">
      <path d="M16 132 H544 M16 16 V132" stroke="currentColor" opacity=".32"
        strokeWidth="1" fill="none"/>
      <polyline points={points} stroke="#8fc0ff" fill="none" strokeWidth="3"
        strokeLinejoin="round" strokeLinecap="round"/>
      {coordinates.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="#8fc0ff"/>)}
    </svg>
    <div style={{display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12}}>
      <span>First: {data[0] ? "$" + data[0].priceUsd.toPrecision(5) : "—"}</span>
      <span>Latest: {data.length ? "$" + data[data.length - 1]!.priceUsd.toPrecision(5) : "—"}</span>
    </div>
    <p className="jh-copy">Unattested provider snapshots · no verified slippage, fees, exits or fills.</p>
  </article>
}

export default function SharkAlphaPage() {
  const [view, setView] = useState<AlphaPublicView | null>(null)
  const [error, setError] = useState("")
  const [filename, setFilename] = useState("")

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    setView(null)
    setFilename("")
    setError("")
    if (!file) return
    if (file.size > 200_000) {
      setError("Local study exceeds the 200 KB limit.")
      return
    }
    try {
      const result: unknown = JSON.parse(await file.text())
      setView(parsePublicAlphaStudy(result))
      setFilename(file.name)
    } catch {
      setError("Not a recognized public, research-only SHARK study. Nothing was uploaded.")
    }
  }

  return <main className="jh-page">
    <div className="jh-wrap" style={{maxWidth: 860}}>
      <p className="jh-eyebrow">Jhadina · SHARK · Capital Lab</p>
      <h1 className="jh-title">Alpha Research</h1>
      <p className="jh-copy">Review only prospectively observed public Solana market evidence.
        No Telegram messages, model training, broker connection, or automated trading.</p>
      <div className="jh-row" style={{marginTop: 14}}>
        <span className="jh-status jh-status--warning">Research only · No trade authority</span>
        <span className="jh-status">Source timestamps not independently attested</span>
      </div>

      <section aria-label="Phantom wallet ownership" style={{marginTop: 18, display: "grid", gap: 10}}>
        <h2 style={{fontSize: 18, fontWeight: 700, margin: 0}}>SHARK wallet connection</h2>
        <p className="jh-copy" style={{margin: 0}}>This uses the same verified Phantom owner wallet as Money Core. Connecting allows read-only wallet recognition, not sniping, transactions, or unattended signing.</p>
        <PhantomWalletCard />
      </section>

      <section className="jh-card" style={{marginTop: 18, display: "grid", gap: 10}}>
        <h2 style={{fontSize: 18, fontWeight: 700, margin: 0}}>Open a local public-market study</h2>
        <p className="jh-copy" style={{margin: 0}}>
          Select a public ALPHA.04–05 JSON study from your iPhone or computer.
          It stays in this browser session. This page makes no upload request.
        </p>
        <label htmlFor="alpha-study-file" style={{fontWeight: 650}}>Local study JSON</label>
        <input id="alpha-study-file" type="file" accept=".json,application/json"
          onChange={selectFile} style={{maxWidth: "100%"}} />
        {filename && <p role="status">Showing: {filename}</p>}
        {error && <p role="alert">{error}</p>}
        {!view && !error && <p className="jh-copy">
          No study loaded. A successful Telegram digest does not automatically create public-market outcomes.
        </p>}
      </section>

      {view && <section aria-label="Public-market evidence" style={{marginTop: 18, display: "grid", gap: 14}}>
        <div className="jh-grid" style={{marginTop: 0}}>
          <article className="jh-card jh-card--third">
            <div className="jh-metric">{view.study.events.length}</div>
            <p className="jh-label">Public observations</p>
          </article>
          <article className="jh-card jh-card--third">
            <div className="jh-metric">{pct(view.priceOnlyReturnPct)}</div>
            <p className="jh-label">24–30h price-only change</p>
          </article>
          <article className="jh-card jh-card--third">
            <div className="jh-metric">—</div>
            <p className="jh-label">Executable net return</p>
          </article>
        </div>
        <article className="jh-card" style={{overflowWrap: "anywhere"}}>
          <h2 style={{fontSize: 18}}>Case and uncertainties</h2>
          <p><strong>Mint:</strong> <code>{view.study.mint}</code></p>
          <p><strong>Original pair:</strong> <code>{view.study.pair}</code></p>
          <p><strong>First observed:</strong> {time(view.study.openedAt)} PT</p>
          <p><strong>Status:</strong> {descriptions[view.lastMark] ?? "Unverified initial public observation"}</p>
          <p><strong>Provider-reported liquidity change:</strong> {pct(view.liquidityChangePctReported)}</p>
          <p><strong>Paper entries:</strong> 0 · <strong>Real trades:</strong> 0</p>
        </article>
        <Trend view={view}/>
        <article className="jh-card">
          <h2 style={{fontSize: 18}}>Observation history</h2>
          <ol style={{paddingLeft: 22, display: "grid", gap: 14}}>
            {view.study.events.map((event, index) => <li key={index}>
              <strong>{time(event.availableAt)} PT</strong>
              <div>{descriptions[event.type] ?? "First public observation, unverified"}</div>
              {typeof event.priceUsd === "number" && <div>Reported price: {"$" + event.priceUsd}</div>}
            </li>)}
          </ol>
          <p className="jh-copy">A local hash is not independent proof of source or timestamp.
            No performance-based Telegram source scoring has been activated.</p>
        </article>
      </section>}
      <div className="jh-row" style={{marginTop: 18}}>
        <Link href="/sports-lab">Sports Lab</Link>
        <a href="https://github.com/bookieandco/crispy-waddle/pull/1367" target="_blank"
          rel="noreferrer">Public evidence method</a>
      </div>
    </div>
  </main>
}
