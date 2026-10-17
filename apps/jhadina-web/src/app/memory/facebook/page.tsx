"use client"

import Link from "next/link"
import { useState } from "react"
import { getCurrentUserId } from "@/lib/auth/current-user"
import {
  previewFacebookExport,
  writingStyleDraft,
  type FacebookImportPreview,
} from "@/lib/personality/facebook-owner-import"

const EXPORT_URL = "https://accountscenter.facebook.com/info_and_permissions/dyi"

export default function FacebookPersonalityImportPage() {
  const [preview, setPreview] = useState<FacebookImportPreview | null>(null)
  const [filename, setFilename] = useState("")
  const [draft, setDraft] = useState("")
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [proposed, setProposed] = useState(false)

  async function onFile(file?: File) {
    setPreview(null)
    setDraft("")
    setFilename("")
    setProposed(false)
    setReviewed(false)
    setError("")
    if (!file) return
    setBusy(true)
    try {
      const result = await previewFacebookExport(file, file.name)
      setFilename(file.name)
      setPreview(result)
      setDraft(writingStyleDraft(result.samples))
      if (result.samples.length === 0) setError("No self-authored writing was found. Try including Posts and Comments in your Facebook JSON export.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not preview this file")
    } finally {
      setBusy(false)
    }
  }

  async function propose() {
    if (!reviewed || !preview || !draft.trim() || proposed) return
    setBusy(true)
    setError("")
    try {
      const userId = await getCurrentUserId()
      if (!userId) throw new Error("Sign in to Jhadina first")
      const response = await fetch("/api/personality/facebook/propose", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-user-id": userId },
        body: JSON.stringify({
          content: draft.trim(),
          reviewed: true,
          sourceCount: preview.samples.length,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Could not propose memory")
      setProposed(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not propose memory")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="jh-page"><div className="jh-wrap" style={{ maxWidth: 960 }}>
      <p className="jh-eyebrow">Memory / Your style</p>
      <h1 className="jh-title">Let Jhadina get to know your voice.</h1>
      <p className="jh-copy">
        Preview your own Facebook posts and comments without giving Jhadina your password.
        Your archive is read inside this browser, not uploaded to our server. Only the
        short note you explicitly review and submit can become a pending memory proposal.
      </p>
      <div className="jh-card" style={{ marginTop: 24 }}>
        <h2 className="jh-card-title">1. Export your Facebook writing</h2>
        <p className="jh-card-copy">
          In Meta Accounts Center, export Posts and Comments, select JSON, then download
          the ZIP. Leave private messages, friends, photos, login information and
          advertising data out of this first import.
        </p>
        <a className="jh-button" href={EXPORT_URL} target="_blank" rel="noopener noreferrer">Open Meta Accounts Center</a>
      </div>
      <div className="jh-card" style={{ marginTop: 16 }}>
        <h2 className="jh-card-title">2. Choose your export</h2>
        <p className="jh-card-copy">ZIP or a JSON file named your_posts or comments. Works on iPhone; large archives may need a smaller date range.</p>
        <label style={{ display: "block", marginTop: 16 }}>
          <span className="jh-label">Facebook export file</span>
          <input className="jh-input" aria-label="Facebook ZIP or JSON export" type="file" accept=".zip,.json,application/zip,application/json" disabled={busy} onChange={(event) => { void onFile(event.target.files?.[0]) }} />
        </label>
        {busy ? <p className="jh-meta" role="status">Processing this request…</p> : null}
        {error ? <p className="jh-error" role="alert">{error}</p> : null}
        {preview ? <div style={{ marginTop: 16 }}>
          <p className="jh-meta">{filename}: {preview.samples.length} distinct self-written entries identified across {preview.filesRead} JSON files.</p>
          {preview.truncated ? <p className="jh-error">This is a partial preview due to file size or safety limits. Do not treat these numbers as a complete account history.</p> : null}
          <h3 className="jh-card-title" style={{ marginTop: 14 }}>Sample excerpts (never sent to Jhadina)</h3>
          <div className="jh-list">
            {preview.samples.slice(0, 8).map((sample, index) => <article className="jh-item" key={index}>
              <p className="jh-meta">{sample.kind} · {sample.at ? new Date(sample.at).toLocaleDateString() : "date unavailable"}</p>
              <p className="jh-card-copy">{sample.text.slice(0, 300)}</p>
            </article>)}
          </div>
        </div> : null}
      </div>
      {preview && preview.samples.length > 0 ? <div className="jh-card" style={{ marginTop: 16 }}>
        <h2 className="jh-card-title">3. Review what Jhadina can remember</h2>
        <p className="jh-card-copy">
          This is a descriptive first-pass writing fingerprint, not a diagnosis or personality verdict.
          Edit it into what you actually want Jhadina to know about you. No excerpts or full posts
          are sent. Inferences about health, religion, politics or other sensitive characteristics are not automatic.
        </p>
        <label style={{ display: "block", marginTop: 16 }}>
          <span className="jh-label">Your editable owner-style note</span>
          <textarea className="jh-input" aria-label="Review owner style note" rows={6} maxLength={900} value={draft} onChange={(event) => { setDraft(event.target.value); setReviewed(false) }} />
        </label>
        <label style={{ display: "flex", alignItems: "start", gap: 8, marginTop: 16 }}>
          <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
          <span className="jh-card-copy">I reviewed this note and want it proposed for my own memory profile. I understand I still need to approve it in the Approval Center.</span>
        </label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
          <button className="jh-button" type="button" disabled={!reviewed || busy || proposed || draft.trim().length < 30} onClick={() => { void propose() }}>
            {proposed ? "Proposed for approval" : "Propose memory for review"}
          </button>
          <button className="jh-button" type="button" disabled={busy} onClick={() => { setPreview(null); setDraft(""); setReviewed(false); setProposed(false); setFilename(""); setError("") }}>
            Clear preview
          </button>
          {proposed ? <Link className="jh-button" href="/approvals">Open Approval Center</Link> : null}
        </div>
        {proposed ? <p className="jh-meta" role="status">Your note is pending approval. No Facebook data has been admitted to Jhadina's personality state.</p> : null}
      </div> : null}
      <p className="jh-meta" style={{ marginTop: 20 }}>
        This import does not connect to Facebook, scrape accounts, ingest Messenger,
        store your ZIP, train a model, or rewrite Jhadina's own personality.
        Approved owner notes enter existing Memory governance; richer Pattern learning
        requires a separately verified integration.
      </p>
      <Link href="/memory" className="jh-button" style={{ marginTop: 12, display: "inline-block" }}>Back to Memory</Link>
    </div></main>
  )
}
