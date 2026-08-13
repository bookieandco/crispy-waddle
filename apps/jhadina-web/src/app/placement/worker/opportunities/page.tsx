"use client";

import { useState } from "react";

export default function WorkerOpportunitiesPage() {
  const [decision, setDecision] = useState<string>("");

  function decide(value: "GRANT" | "DECLINE") {
    setDecision(value === "GRANT"
      ? "Consent granted. The agency may receive the approved referral information."
      : "Declined. No referral information will be released.");
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 32 }}>
      <p style={{ opacity: 0.65 }}>Jhadina / My Opportunities</p>
      <h1>You have a job match</h1>
      <p>Jhadina found an opportunity that matches your career profile.</p>

      <section style={{ border: "1px solid currentColor", borderRadius: 12, padding: 20, marginTop: 24 }}>
        <h2>Warehouse Associate</h2>
        <p>Dallas · Evening shift · 10 openings</p>
        <h3>Why you matched</h3>
        <ul>
          <li>Warehouse experience</li>
          <li>Forklift skill</li>
          <li>Verified forklift credential</li>
        </ul>
      </section>

      <section style={{ border: "1px solid currentColor", borderRadius: 12, padding: 20, marginTop: 24 }}>
        <h2>Agency referral request</h2>
        <p>An approved staffing agency wants to review you for this job.</p>
        <h3>Information requested</h3>
        <ul>
          <li>Relevant work history</li>
          <li>Matching skills</li>
          <li>Verified credentials</li>
          <li>Availability</li>
        </ul>
        <p>You can decline. Declining does not affect your account or other opportunities.</p>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => decide("GRANT")}>Approve referral</button>
          <button onClick={() => decide("DECLINE")}>Decline</button>
        </div>
      </section>

      {decision && <p role="status">{decision}</p>}
    </main>
  );
}
