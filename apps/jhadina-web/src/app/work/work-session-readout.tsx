"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentUserId } from "@/lib/auth/current-user";
import type { RuntimeWorkProjection } from "@jhadina/core-spine";

type SessionRead = {
  success: true;
  workSessionId: string;
  goal: string;
  sessionStatus: string;
  coverage: "canonical-work-session-only";
  projection: RuntimeWorkProjection;
};

function tone(kind: string): string {
  if (["blocked", "retry-exhausted", "lease-recovery"].includes(kind)) {
    return "jh-status jh-status--danger";
  }
  return "jh-status jh-status--warning";
}

/** Purely observational: all approval/execute controls live on governed routes. */
export default function WorkSessionReadout() {
  const [id, setId] = useState("");
  const [read, setRead] = useState<SessionRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("session") || "";
    if (/^[a-zA-Z0-9_-]{1,128}$/.test(param)) setId(param);
  }, []);

  async function load() {
    setError("");
    setRead(null);
    const target = id.trim();
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(target)) {
      setError("Enter a valid WorkSession ID from Ask Jhadina.");
      return;
    }
    setLoading(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error("Sign in to view your work.");
      const response = await fetch(
        "/api/jhadina/work-sessions/" + encodeURIComponent(target) + "/projection",
        { cache: "no-store", credentials: "same-origin", headers: { "x-jhadina-user-id": userId } },
      );
      const result = await response.json() as SessionRead | { success: false; error: string };
      if (!response.ok || !result.success) {
        throw new Error(response.status === 404
          ? "WorkSession not found for your account."
          : response.status === 503
            ? "WorkSession evidence is currently unavailable."
            : "Unable to read this WorkSession.");
      }
      setRead(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "WorkSession unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return <section className="jh-section" aria-labelledby="work-session-title">
    <div className="jh-card jh-card--wide">
      <p className="jh-eyebrow">Actual work evidence</p>
      <h2 className="jh-section-title" id="work-session-title">Follow a WorkSession</h2>
      <p className="jh-card-copy">Check the tasks and blockers recorded for a specific session. This is not a claim that every Jhadina subsystem is live, and viewing work never retries or approves an action.</p>
      <form className="jh-row" style={{ marginTop: 16 }} onSubmit={event => { event.preventDefault(); void load(); }}>
        <label htmlFor="jh-work-session-id" className="jh-meta">Session ID</label>
        <input id="jh-work-session-id" className="jh-input" value={id}
          onChange={event => setId(event.target.value)} maxLength={128}
          placeholder="Enter your WorkSession ID" autoComplete="off" />
        <button className="jh-button jh-button--primary" type="submit" disabled={loading}>
          {loading ? "Reading…" : "Read work"}
        </button>
      </form>
      {error && <div className="jh-error" role="alert">{error}</div>}
      {read && <div aria-live="polite">
        <div className="jh-between" style={{ marginTop: 20 }}>
          <div><p className="jh-meta">Session · {read.sessionStatus}</p>
            <h3 className="jh-card-title">{read.goal}</h3></div>
          <span className="jh-status">Stored evidence only</span>
        </div>
        <div className="jh-grid" style={{ marginTop: 14 }}>
          <div className="jh-card jh-card--third"><strong className="jh-metric">{read.projection.totalTasks}</strong><p className="jh-label">Recorded tasks</p></div>
          <div className="jh-card jh-card--third"><strong className="jh-metric">{read.projection.humanAttentionCount}</strong><p className="jh-label">Needs attention</p></div>
          <div className="jh-card jh-card--third"><strong className="jh-metric">{read.projection.terminalCount}</strong><p className="jh-label">Terminal tasks</p></div>
        </div>
        {read.projection.totalTasks === 0
          ? <p className="jh-meta">No task receipts exist in this session. Work may be uncommissioned or tracked in a separate domain.</p>
          : null}
        {read.projection.attention.humanAttention.length > 0
          ? <div className="jh-list" style={{ marginTop: 18 }}>
            {read.projection.attention.humanAttention.map(item =>
              <article className="jh-item" key={item.taskId}>
                <span className={tone(item.kind)}>{item.kind}</span>
                <p className="jh-card-copy">{item.domain} · {item.capability}</p>
                <p className="jh-meta">{item.reason || "Human attention required"} · {item.taskId}</p>
              </article>)}
          </div> : null}
        {read.projection.attention.systemAttention.length > 0
          ? <p className="jh-meta">System attention: {read.projection.attention.systemAttention.length}. Recovery is indicated by the canonical projection; it is not automatically started by this view.</p> : null}
        {read.projection.recent.length > 0
          ? <div className="jh-list" style={{ marginTop: 12 }}>
            {read.projection.recent.map(item =>
              <div className="jh-item" key={item.id}>
                <div className="jh-between"><span>{item.domain} · {item.capability}</span><span className="jh-status">{item.status}</span></div>
                <p className="jh-meta">Attempt {item.attempt}/{item.maxAttempts} · {item.updatedAt}</p>
              </div>)}
          </div> : null}
        <div className="jh-row" style={{ marginTop: 16 }}>
          <Link className="jh-button" href="/approvals">Review approvals</Link>
          <Link className="jh-button" href="/activity">Action history</Link>
        </div>
      </div>}
    </div>
  </section>;
}
