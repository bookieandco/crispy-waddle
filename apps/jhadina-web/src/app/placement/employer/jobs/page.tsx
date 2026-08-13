"use client";

import { FormEvent, useState } from "react";

export default function EmployerJobsPage() {
  const [status, setStatus] = useState<string>("");

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Job command prepared. Backend composition is the next wiring step.");
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 32 }}>
      <p style={{ opacity: 0.65 }}>Jhadina / Employer Command</p>
      <h1>Create a Job</h1>
      <p>Create a requisition that can enter the governed staffing marketplace.</p>

      <form onSubmit={createJob} style={{ display: "grid", gap: 16, maxWidth: 640 }}>
        <label>
          Job title
          <input name="title" required style={{ display: "block", width: "100%", padding: 10 }} />
        </label>
        <label>
          Openings
          <input name="openings" type="number" min={1} defaultValue={1} required style={{ display: "block", width: "100%", padding: 10 }} />
        </label>
        <label>
          Location
          <input name="location" required style={{ display: "block", width: "100%", padding: 10 }} />
        </label>
        <label>
          Shift
          <input name="shift" required placeholder="Day / Evening / Overnight" style={{ display: "block", width: "100%", padding: 10 }} />
        </label>
        <label>
          Requirements
          <textarea name="requirements" rows={5} placeholder="One requirement per line" style={{ display: "block", width: "100%", padding: 10 }} />
        </label>
        <button type="submit" style={{ padding: "12px 16px", width: "fit-content" }}>
          Create requisition
        </button>
      </form>

      {status && <p role="status">{status}</p>}
    </main>
  );
}
