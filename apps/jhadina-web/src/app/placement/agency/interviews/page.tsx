"use client";

import { useState } from "react";

export default function AgencyInterviewsPage() {
  const [status, setStatus] = useState("");

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 32 }}>
      <p style={{ opacity: 0.65 }}>Jhadina / Agency Command</p>
      <h1>Interview & Offer</h1>
      <p>Move a consented referral from review toward placement.</p>

      <section style={{ border: "1px solid currentColor", borderRadius: 12, padding: 20, marginTop: 24 }}>
        <h2>Candidate A</h2>
        <p>Warehouse Associate · Consent granted · 100% match</p>
        <button onClick={() => setStatus("Interview requested. Awaiting scheduling confirmation.")}>Request interview</button>
      </section>

      <section style={{ border: "1px solid currentColor", borderRadius: 12, padding: 20, marginTop: 24 }}>
        <h2>Offer</h2>
        <label>
          Worker pay rate
          <input type="number" min="0" step="0.01" defaultValue="18" style={{ display: "block", padding: 10, marginTop: 6 }} />
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          Bill rate
          <input type="number" min="0" step="0.01" defaultValue="27" style={{ display: "block", padding: 10, marginTop: 6 }} />
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          Start date
          <input type="date" style={{ display: "block", padding: 10, marginTop: 6 }} />
        </label>
        <button style={{ marginTop: 16 }} onClick={() => setStatus("Offer prepared. Worker acceptance is required before placement.")}>Propose offer</button>
      </section>

      {status && <p role="status">{status}</p>}
    </main>
  );
}
