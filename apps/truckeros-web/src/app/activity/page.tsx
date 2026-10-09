"use client"

import { useCallback, useEffect, useState } from "react"
import type { AuditEvent, MemoryCandidate } from "@jhadina/truckeros-core"
import { apiGet, apiPost } from "@/lib/apiClient"

export default function ActivityPage() {
  const [candidates, setCandidates] = useState<MemoryCandidate[]>([])
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [candidateData, auditData] = await Promise.all([
        apiGet<{ candidates: MemoryCandidate[] }>("/api/memory/candidates"),
        apiGet<{ events: AuditEvent[] }>("/api/audit?limit=30"),
      ])
      setCandidates(candidateData.candidates)
      setEvents(auditData.events)
    } catch (err) {
      console.error("[Activity] failed to load", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function resolveCandidate(id: string, approve: boolean) {
    try {
      await apiPost(`/api/memory/candidates/${id}/${approve ? "approve" : "reject"}`)
      await refresh()
    } catch (err) {
      console.error("[Activity] failed to resolve candidate", err)
    }
  }

  if (loading) {
    return (
      <main className="page">
        <div className="empty-state">Loading activity…</div>
      </main>
    )
  }

  return (
    <main className="page stack">
      <header className="page-header">
        <div>
          <a className="back-link" href="/">
            ← Home
          </a>
          <h1 className="h1">Activity</h1>
        </div>
      </header>

      <section className="stack">
        <div className="subtle">🤖 Pending memory candidates</div>
        {candidates.length === 0 && <div className="empty-state">Nothing awaiting approval.</div>}
        {candidates.map((candidate) => (
          <div key={candidate.id} className="card stack">
            <div style={{ fontSize: 13 }}>{candidate.observationText}</div>
            <div className="mono subtle" style={{ fontSize: 11 }}>
              Proposed: {candidate.proposedPreference.key} = {candidate.proposedPreference.value} (weight{" "}
              {candidate.proposedPreference.weight})
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" type="button" onClick={() => resolveCandidate(candidate.id, true)}>
                Approve
              </button>
              <button className="btn" type="button" onClick={() => resolveCandidate(candidate.id, false)}>
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="stack">
        <div className="subtle">🧾 Audit ledger</div>
        <div className="card">
          {events.length === 0 && <div className="empty-state">No events recorded yet.</div>}
          {events.map((event) => (
            <div key={event.id} className="audit-entry stack">
              <div className="row-between">
                <span className="mono" style={{ fontSize: 11 }}>
                  {event.eventName}
                </span>
                <span className="subtle" style={{ fontSize: 10 }}>
                  {new Date(event.occurredAt).toLocaleTimeString()}
                </span>
              </div>
              <div className="subtle" style={{ fontSize: 11 }}>
                {event.actorType}:{event.actorId} · triggered by {event.triggeredBy}
                {event.driverApproved !== null && (event.driverApproved ? " · driver approved" : " · driver did not approve")}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
