"use client";

import { useState } from "react";

export default function WorkerOffersPage() {
  const [status, setStatus] = useState("");

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 32 }}>
      <p style={{ opacity: 0.65 }}>Jhadina / My Offers</p>
      <h1>You have an offer</h1>
      <p>Review the assignment and decide whether you want to accept it.</p>

      <section style={{ border: "1px solid currentColor", borderRadius: 12, padding: 20, marginTop: 24 }}>
        <h2>Warehouse Associate</h2>
        <dl>
          <dt>Pay</dt><dd>$18.00 / hour</dd>
          <dt>Shift</dt><dd>Evening</dd>
          <dt>Start</dt><dd>Pending confirmation</dd>
          <dt>Assignment</dt><dd>Temporary staffing placement</dd>
        </dl>
        <p>Accepting this offer allows the staffing agency to create your assignment. You can decline without affecting other opportunities.</p>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => setStatus("Offer accepted. Placement creation is now authorized.")}>Accept offer</button>
          <button onClick={() => setStatus("Offer declined.")}>Decline</button>
        </div>
      </section>

      {status && <p role="status">{status}</p>}
    </main>
  );
}
