"use client";

import { useState } from "react";

const referrals = [
  {
    id: "ref-001",
    candidate: "Candidate A",
    score: 1,
    skills: ["warehouse", "forklift"],
    credentials: ["Forklift"],
    availability: "Immediate",
  },
];

export default function AgencyReferralsPage() {
  const [status, setStatus] = useState("");

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 32 }}>
      <p style={{ opacity: 0.65 }}>Jhadina / Agency Command</p>
      <h1>Referral Review</h1>
      <p>Only worker-approved information is displayed here.</p>

      <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
        {referrals.map((referral) => (
          <article key={referral.id} style={{ border: "1px solid currentColor", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <div>
                <h2>{referral.candidate}</h2>
                <p>{Math.round(referral.score * 100)}% requirement match</p>
              </div>
              <strong>Consent granted</strong>
            </div>

            <h3>Approved information</h3>
            <ul>
              <li>Skills: {referral.skills.join(", ")}</li>
              <li>Verified credentials: {referral.credentials.join(", ")}</li>
              <li>Availability: {referral.availability}</li>
            </ul>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setStatus("Interview request prepared.")}>Schedule interview</button>
              <button onClick={() => setStatus("Referral declined.")}>Decline referral</button>
            </div>
          </article>
        ))}
      </div>

      {status && <p role="status">{status}</p>}
    </main>
  );
}
