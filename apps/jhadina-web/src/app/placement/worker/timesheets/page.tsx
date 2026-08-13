"use client";

import { useState } from "react";

export default function WorkerTimesheetsPage() {
  const [status, setStatus] = useState("");

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 32 }}>
      <p style={{ opacity: 0.65 }}>Jhadina / My Assignment</p>
      <h1>Timesheet</h1>
      <p>Submit hours for your current temporary assignment.</p>

      <section style={{ border: "1px solid currentColor", borderRadius: 12, padding: 20, marginTop: 24 }}>
        <h2>Warehouse Associate</h2>
        <p>Evening shift · Supervisor: Assigned</p>
        <label>
          Week starting
          <input type="date" style={{ display: "block", padding: 10, marginTop: 6 }} />
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          Hours worked
          <input type="number" min="0" max="168" step="0.25" defaultValue="40" style={{ display: "block", padding: 10, marginTop: 6 }} />
        </label>
        <button style={{ marginTop: 16 }} onClick={() => setStatus("Timesheet submitted for supervisor approval.")}>Submit timesheet</button>
      </section>

      {status && <p role="status">{status}</p>}
    </main>
  );
}
