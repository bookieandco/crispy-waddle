import React, { useEffect, useState } from "react"

export default function ActivityPage() {
  const [events, setEvents] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/system/activity").then((r) => r.json()).then((d) => setEvents(d.events || [])).catch(() => setEvents([]))
  }, [])

  return (
    <main style={{ minHeight: "100vh", background: "#07080b", color: "#fff", padding: "32px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <a href="/" style={{ color: "inherit", opacity: .5 }}>← Mission Control</a>
        <h1 style={{ fontSize: 40, margin: "28px 0 8px" }}>Activity & Audit</h1>
        <p style={{ opacity: .5 }}>The visible trail of agent handoffs and system activity.</p>
        <div style={{ marginTop: 28, display: "grid", gap: 10 }}>
          {events.length === 0 ? <div style={{ border: "1px solid rgba(255,255,255,.09)", borderRadius: 18, padding: 22, opacity: .55 }}>No activity recorded yet.</div> : events.map((event, i) => (
            <article key={event.id || i} style={{ border: "1px solid rgba(255,255,255,.09)", borderRadius: 18, padding: 18, background: "rgba(255,255,255,.035)" }}>
              <div style={{ fontSize: 11, opacity: .4, letterSpacing: ".15em" }}>{event.type || "EVENT"}</div>
              <div style={{ marginTop: 8 }}>{event.from || "SYSTEM"} → {event.to || "SYSTEM"}</div>
              <div style={{ marginTop: 6, fontSize: 12, opacity: .45 }}>{event.occurredAt || event.timestamp || ""}</div>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
