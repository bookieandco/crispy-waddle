"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { getCurrentUserId } from "@/lib/auth/current-user"

type ActivityEvent = {
  id: string
  actionId: string
  type: string
  status: "started" | "approval_required" | "completed" | "denied" | "failed"
  timestamp: string
  domain: string
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    void (async () => {
      try {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error("Not signed in")
        const response = await fetch("/api/system/activity", { headers: { "x-jhadina-user-id": userId } })
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || "Unable to load activity")
        setEvents(json.events ?? [])
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load activity")
      }
    })()
  }, [])

  return (
    <main style={{ minHeight: "100vh", padding: "28px 18px 110px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link href="/">← Jhadina</Link>
        <h1>Activity & Audit</h1>
        <p>Verified activity from Jhadina&apos;s existing governed audit ledger.</p>
        {error && <p role="alert">{error}</p>}
        {!error && events.length === 0 && <p>No governed activity recorded yet.</p>}
        {events.map((event) => (
          <article key={event.id} style={{ padding: 16, marginTop: 10, border: "1px solid #ddd", borderRadius: 16 }}>
            <strong>{event.domain} · {event.type}</strong>
            <div>{event.status}</div>
            <small>{event.timestamp}</small>
          </article>
        ))}
      </div>
    </main>
  )
}
