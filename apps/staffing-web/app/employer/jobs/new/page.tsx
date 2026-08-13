"use client";

import { FormEvent, useState } from "react";
import { validateJobDraft } from "../../../../lib/staffing.js";

export default function NewJobPage() {
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const errors = validateJobDraft({
      title: String(data.get("title") ?? ""),
      description: String(data.get("description") ?? ""),
      location: String(data.get("location") ?? ""),
      payRate: Number(data.get("payRate")),
    });
    setMessage(errors.length ? errors.join(" · ") : "Job validated by Staffing Core. Persistence endpoint is the next connection point.");
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 40 }}>
      <a href="/employer">← Employer Command Center</a>
      <h1>Create a job</h1>
      <p>This form uses the standalone Staffing Core validation boundary.</p>
      <form onSubmit={submit} style={{ display: "grid", gap: 16, marginTop: 24 }}>
        <input name="title" placeholder="Job title" required />
        <textarea name="description" placeholder="Describe the work" rows={6} required />
        <input name="location" placeholder="Worksite / remote" required />
        <input name="payRate" type="number" min="0.01" step="0.01" placeholder="Pay rate" required />
        <button type="submit">Validate & continue</button>
      </form>
      {message && <p role="status" style={{ marginTop: 20 }}>{message}</p>}
    </main>
  );
}
