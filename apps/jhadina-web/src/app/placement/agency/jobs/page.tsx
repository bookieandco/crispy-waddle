"use client";

import { useMemo, useState } from "react";

const demoWorkers = [
  { id: "worker-001", name: "Candidate A", skills: ["warehouse", "forklift"], credentials: ["Forklift"], availability: "Immediate" },
  { id: "worker-002", name: "Candidate B", skills: ["warehouse", "inventory"], credentials: [], availability: "Next week" },
  { id: "worker-003", name: "Candidate C", skills: ["hospitality", "inventory"], credentials: [], availability: "Immediate" },
];

export default function AgencyJobsPage() {
  const [requirements, setRequirements] = useState("warehouse\nforklift");
  const [status, setStatus] = useState("");
  const job = useMemo(() => requirements.split("\n").filter(Boolean), [requirements]);

  const matches = useMemo(() => demoWorkers.map((worker) => {
    const matched = job.filter((req) => worker.skills.includes(req.toLowerCase())).length;
    return { ...worker, score: job.length ? matched / job.length : 0 };
  }).sort((a, b) => b.score - a.score), [job]);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 32 }}>
      <p style={{ opacity: 0.65 }}>Jhadina / Agency Command</p>
      <h1>Jobs & Candidate Matching</h1>
      <p>Review an open requisition and see explainable candidate matches.</p>

      <section style={{ border: "1px solid currentColor", borderRadius: 12, padding: 20, marginTop: 24 }}>
        <h2>Open Requisition</h2>
        <strong>Warehouse Associate</strong>
        <p>Dallas · 10 openings · Evening shift</p>
        <label>
          Requirements
          <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={4} style={{ display: "block", width: "100%", maxWidth: 600, padding: 10 }} />
        </label>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Qualified candidates</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {matches.map((worker) => (
            <article key={worker.id} style={{ border: "1px solid currentColor", borderRadius: 12, padding: 16 }}>
              <strong>{worker.name}</strong>
              <p>{Math.round(worker.score * 100)}% requirement match · {worker.availability}</p>
              <p>Skills: {worker.skills.join(", ")}</p>
              <p>Verified credentials: {worker.credentials.join(", ") || "None"}</p>
              <button onClick={() => setStatus(`Referral request prepared for ${worker.name}. Worker consent is required before sharing.`)}>
                Request referral
              </button>
            </article>
          ))}
        </div>
      </section>

      {status && <p role="status">{status}</p>}
    </main>
  );
}
