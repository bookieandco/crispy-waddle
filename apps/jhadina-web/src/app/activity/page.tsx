"use client"

import { useEffect, useState } from "react"
import { getCurrentUserId } from "@/lib/auth/current-user"

type ActivityEvent = {
  id: string
  actionId: string
  userId: string
  type: string
  status: "started" | "approval_required" | "completed" | "denied" | "failed"
  timestamp: string
  metadata?: Record<string, unknown>
}

const statusLabel: Record<ActivityEvent["status"], string> = {
  started: "Started",
  approval_required: "Awaiting approval",
  completed: "Completed",
  denied: "Denied",
  failed: "Failed",
}

const statusColor: Record<ActivityEvent["status"], { bg: string; fg: string }> = {
  started: { bg: "#eef1ed", fg: "#657169" },
  approval_required: { bg: "#f3ecd8", fg: "#8a7233" },
  completed: { bg: "#e2ede4", fg: "#3d7350" },
  denied: { bg: "#f5e1dc", fg: "#8d5148" },
  failed: { bg: "#f5e1dc", fg: "#8d5148" },
}

/**
 * Jhadina OS Integration Phase 2: the Activity Timeline. Reads the
 * governed Growth audit ledger through /api/growth/activity — never
 * imports the ledger, action-core, or governed-approval-runtime
 * directly. This page only ever knows JSON events came back from a
 * fetch; the governance boundary lives entirely server-side.
 */
export default function ActivityTimeline() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError("")
      try {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error("Not signed in")
        const res = await fetch("/api/growth/activity", { headers: { "x-jhadina-user-id": userId } })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Could not load activity")
        if (!cancelled) setEvents(json.data?.events ?? [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load activity")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const sorted = [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  return <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#f5f1ea,#edf2ed 55%,#f3eee8)", color: "#29332e", padding: "28px 18px 110px", fontFamily: 'ui-rounded,"Avenir Next",Avenir,system-ui,sans-serif' }}>
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <div style={{ fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "#77847c" }}>Jhadina Activity</div>
      <h1 style={{ margin: "12px 0 8px", fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 400, fontSize: "clamp(32px,8vw,50px)", letterSpacing: "-.045em", lineHeight: 1 }}>Everything Jhadina has done, in order.</h1>
      <p style={{ margin: 0, color: "#718078", lineHeight: 1.65, maxWidth: 590 }}>A governed action only appears here once it has actually passed through identity, policy, and (where required) your explicit approval — this is the audit ledger, not a status guess.</p>

      {error && <div role="alert" style={{ marginTop: 24, padding: 13, borderRadius: 16, background: "#f5e1dc", color: "#8d5148" }}>{error}</div>}
      {loading ? <p style={{ marginTop: 24, color: "#7b877f" }}>Loading your activity…</p> : sorted.length === 0 ? (
        !error && <div style={{ marginTop: 24, padding: 20, borderRadius: 20, background: "rgba(255,255,255,.55)", border: "1px solid #dce2dd", color: "#68756e" }}>Nothing recorded yet. Approve a Growth draft and it will show up here.</div>
      ) : (
        <ol style={{ listStyle: "none", margin: "26px 0 0", padding: 0, display: "grid", gap: 10 }}>
          {sorted.map((event) => {
            const color = statusColor[event.status]
            return <li key={event.id} style={{ padding: 16, borderRadius: 20, background: "rgba(255,255,255,.72)", border: "1px solid #dce2dd", boxShadow: "0 10px 28px rgba(67,76,69,.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, letterSpacing: ".11em", textTransform: "uppercase", color: "#758179" }}>{event.type}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: color.bg, color: color.fg }}>{statusLabel[event.status]}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: "#657169" }}>{new Date(event.timestamp).toLocaleString()}</div>
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div style={{ marginTop: 10, padding: 11, borderRadius: 14, background: "#eef1ed", color: "#657169", fontSize: 12.5, lineHeight: 1.55 }}>
                  {Object.entries(event.metadata).map(([key, value]) => <div key={key}><strong>{key}:</strong> {String(value)}</div>)}
                </div>
              )}
            </li>
          })}
        </ol>
      )}
    </div>
  </main>
}
