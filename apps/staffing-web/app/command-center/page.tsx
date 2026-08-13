"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Signal = { label: string; value: number; href: string; description: string };

export default function CommandCenterPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const organizationId = process.env.NEXT_PUBLIC_STAFFING_ORGANIZATION_ID;

  useEffect(() => {
    if (!organizationId) { setError("No staffing organization is configured."); return; }
    Promise.all([
      fetch(`/api/command-center?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" }).then(r => r.ok ? r.json() : Promise.reject(new Error("Command Center unavailable")))
    ]).then(([data]) => setSignals(data.signals ?? [])).catch(e => setError(e instanceof Error ? e.message : "Unable to load Command Center"));
  }, [organizationId]);

  return <main style={{ padding: 32, maxWidth: 1280, margin: "0 auto" }}>
    <header><p style={{ opacity: .55, letterSpacing: 1 }}>MISSION CONTROL</p><h1>Staffing Command Center</h1><p>See what needs attention, decide what matters, and act without leaving the operating system.</p></header>
    {error && <section role="alert" style={{ margin: "24px 0", padding: 16, border: "1px solid currentColor" }}>{error}</section>}
    <section style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginTop: 32 }}>
      {signals.map(signal => <Link key={signal.href} href={signal.href} style={{ textDecoration: "none", color: "inherit", padding: 20, border: "1px solid #ddd", borderRadius: 12 }}><small style={{ opacity: .6 }}>{signal.label}</small><h2>{signal.value}</h2><p style={{ opacity: .65 }}>{signal.description}</p></Link>)}
      {!signals.length && !error && <p style={{ opacity: .6 }}>Loading operational signals…</p>}
    </section>
    <section style={{ marginTop: 40, padding: 24, border: "1px solid #ddd", borderRadius: 12 }}><h2>Operating principle</h2><p>Awareness → Decisions → Control → Trust. Every operational signal should lead to a traceable action or an explicit reason why no action is required.</p></section>
  </main>;
}
