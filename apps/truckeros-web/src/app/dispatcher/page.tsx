"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import type { DispatcherBrief, DispatcherCandidate, LoadOffer } from "@jhadina/truckeros-core"
import { apiPost } from "@/lib/apiClient"

const DEMO_LOADS: LoadOffer[] = [
  {
    id: "demo-houston-dallas",
    origin: "Houston, TX",
    destination: "Dallas, TX",
    pickupAt: null,
    deliveryAt: null,
    revenueCents: 210_000,
    loadedMiles: 240,
    deadheadMiles: 40,
    fuelCostCents: 31_000,
    tollCostCents: 4_800,
    otherCostCents: 7_500,
    brokerName: "Example Broker",
  },
  {
    id: "demo-houston-austin",
    origin: "Houston, TX",
    destination: "Austin, TX",
    pickupAt: null,
    deliveryAt: null,
    revenueCents: 155_000,
    loadedMiles: 165,
    deadheadMiles: 25,
    fuelCostCents: 22_000,
    tollCostCents: 0,
    otherCostCents: 5_000,
    brokerName: "Example Broker",
  },
  {
    id: "demo-houston-sanantonio",
    origin: "Houston, TX",
    destination: "San Antonio, TX",
    pickupAt: null,
    deliveryAt: null,
    revenueCents: 120_000,
    loadedMiles: 200,
    deadheadMiles: 80,
    fuelCostCents: 26_000,
    tollCostCents: 0,
    otherCostCents: 6_000,
    brokerName: "Example Broker",
  },
]

type DispatcherResponse = {
  brief: DispatcherBrief
  explanation: string
  safety: {
    aiRole: "advisory"
    economicsSource: "deterministic"
    executionAllowed: false
    requiresDriverApproval: true
  }
}

export default function DispatcherPage() {
  const [message, setMessage] = useState("Find me the best load and tell me what I would actually make.")
  const [result, setResult] = useState<DispatcherResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function askDispatcher(event?: FormEvent) {
    event?.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const data = await apiPost<DispatcherResponse>("/api/dispatcher", {
        message,
        context: {
          loads: DEMO_LOADS,
          minimumNetCentsPerMile: 400,
          targetNetCentsPerMile: 500,
        },
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dispatcher request failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page stack">
      <header className="page-header">
        <div>
          <div className="subtle">Truckeros</div>
          <h1 className="h1">AI Dispatcher</h1>
        </div>
        <Link className="back-link" href="/">Driver Home</Link>
      </header>

      <section className="card stack">
        <div className="row-between">
          <div>
            <div className="subtle">Your dispatcher</div>
            <h2 style={{ margin: 0 }}>What do you need?</h2>
          </div>
          <span className="subtle mono">ADVISORY</span>
        </div>

        <form onSubmit={askDispatcher} className="stack">
          <label htmlFor="dispatcher-message" className="subtle">
            Ask in plain English
          </label>
          <textarea
            id="dispatcher-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Find me the best load going toward Dallas."
            style={{ width: "100%", resize: "vertical" }}
          />
          <button className="btn btn-primary" type="submit" disabled={loading || !message.trim()}>
            {loading ? "Dispatcher is thinking…" : "Ask Dispatcher"}
          </button>
        </form>

        <div className="subtle">
          Demo load board for now. The dispatcher API is ready for a real load provider next.
        </div>
      </section>

      {error && <div className="card" role="alert">{error}</div>}

      {result && (
        <>
          <section className="card stack">
            <div className="subtle">Dispatcher recommendation</div>
            <h2 style={{ margin: 0 }}>{result.brief.headline}</h2>
            <p style={{ margin: 0 }}>{result.explanation}</p>

            {result.brief.warnings.length > 0 && (
              <div className="stack">
                {result.brief.warnings.map((warning) => (
                  <div key={warning} className="subtle">⚠️ {warning}</div>
                ))}
              </div>
            )}

            <div className="subtle">
              AI is advisory. Economics are deterministic. Nothing can be booked from this screen without driver approval.
            </div>
          </section>

          <section className="stack">
            <div className="row-between">
              <div className="subtle">Ranked loads</div>
              <div className="subtle">{result.brief.candidates.length} evaluated</div>
            </div>

            {result.brief.candidates.map((candidate, index) => (
              <CandidateCard key={candidate.load.id} candidate={candidate} rank={index + 1} />
            ))}
          </section>
        </>
      )}

      <nav className="row" style={{ justifyContent: "center", gap: 24, paddingTop: 8 }}>
        <Link className="back-link" href="/profile">Profile</Link>
        <Link className="back-link" href="/activity">Activity</Link>
      </nav>
    </main>
  )
}

function CandidateCard({ candidate, rank }: { candidate: DispatcherCandidate; rank: number }) {
  const net = candidate.economics.netProfitCents / 100
  const perMile = candidate.economics.netCentsPerMile / 100
  const gross = candidate.economics.grossRevenueCents / 100
  const costs = candidate.economics.totalCostsCents / 100

  return (
    <article className="card stack">
      <div className="row-between">
        <strong>#{rank} {candidate.load.origin} → {candidate.load.destination}</strong>
        <strong style={{ textTransform: "uppercase" }}>{candidate.recommendation}</strong>
      </div>

      <div className="grid-2">
        <Metric label="Gross" value={`$${gross.toFixed(2)}`} />
        <Metric label="Estimated net" value={`$${net.toFixed(2)}`} />
        <Metric label="Net / mile" value={`$${perMile.toFixed(2)}`} />
        <Metric label="Total miles" value={String(candidate.economics.totalMiles)} />
        <Metric label="Deadhead" value={`${candidate.load.deadheadMiles} mi`} />
        <Metric label="Estimated costs" value={`$${costs.toFixed(2)}`} />
      </div>

      <div className="stack">
        {candidate.reasons.map((reason) => (
          <div key={reason} className="subtle">• {reason}</div>
        ))}
      </div>
    </article>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="subtle">{label}</div>
      <div className="mono">{value}</div>
    </div>
  )
}
