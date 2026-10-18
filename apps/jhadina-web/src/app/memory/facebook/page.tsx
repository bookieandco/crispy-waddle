"use client"

import Link from "next/link"
import * as React from "react"
import { useMemo, useRef, useState } from "react"
import { getCurrentUserId } from "@/lib/auth/current-user"
import { buildOwnerWritingProfileDraft, deriveOwnerWritingSignals, type OwnerWritingSignalId } from "@/lib/personality/facebook-owner-signals"
import {
  previewFacebookExports,
  summarizeFacebookYears,
  formatFacebookAuditSummary,
  diagnoseFacebookZipImportFailure,
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
  const [zipDiagnostic, setZipDiagnostic] = useState("")
  const [progress, setProgress] = useState("")
  const [proposed, setProposed] = useState(false)
  const [selectedSignals, setSelectedSignals] = useState<OwnerWritingSignalId[]>([])
  const [interactionPreference, setInteractionPreference] = useState("")
  const [interactionOptIn, setInteractionOptIn] = useState(false)
  const [interactionProposed, setInteractionProposed] = useState(false)
  const [auditCopyStatus, setAuditCopyStatus] = useState("")
  const [showAuditFallback, setShowAuditFallback] = useState(false)
  const signals = useMemo(() => preview ? deriveOwnerWritingSignals(preview.samples) : [], [preview])
  const coverage = React.useMemo(() => preview ? summarizeFacebookYears(preview.samples) : [], [preview])
  const aggregateAudit = useMemo(() => preview ? formatFacebookAuditSummary(preview) : "", [preview])
  const activeImport = useRef<AbortController | null>(null)

  async function onFiles(files: readonly File[]) {
    activeImport.current?.abort()
    activeImport.current = null
    setPreview(null)
    setSelectedSignals([])
    setDraft("")
    setFilename("")
    setProposed(false)
    setReviewed(false)
    setInteractionProposed(false)
    setInteractionOptIn(false)
    setInteractionPreference("")
    setAuditCopyStatus("")
    setShowAuditFallback(false)
    setError("")
    setZipDiagnostic("")
    setProgress("")
    if (!files.length) return
    const controller = new AbortController()
    activeImport.current = controller
    let lastImportProgress = ""
    setBusy(true)
    try {
      const result = await previewFacebookExports(files.map((file) => ({ blob: file, name: file.name })), controller.signal, (label) => {
        if (activeImport.current === controller) {
          lastImportProgress = label
          setProgress(label)
        }
      })
      if (activeImport.current !== controller) return
      setFilename(files.length === 1 ? files[0].name : files.length + " selected exports")
      setProgress("")
      setPreview(result)
      const found = deriveOwnerWritingSignals(result.samples)
      setSelectedSignals(found.map((signal) => signal.id))
      setDraft(buildOwnerWritingProfileDraft(result.samples, found))
      if (result.samples.length === 0) setError("No self-authored writing was found. Try including Posts and Comments in your Facebook JSON export.")
    } catch (cause) {
      if (activeImport.current !== controller) return
      setError(cause instanceof Error ? cause.message : "Could not preview this file")
      if (files.length === 1 && /\.zip$/i.test(files[0].name) && !controller.signal.aborted) {
        const summary = await diagnoseFacebookZipImportFailure(files[0], cause, lastImportProgress)
        if (activeImport.current === controller && !controller.signal.aborted) setZipDiagnostic(summary)
      }
    } finally {
      if (activeImport.current === controller) {
        activeImport.current = null
        setBusy(false)
      }
    }
  }

  async function copyLocalAudit() {
    if (!preview) return
    setAuditCopyStatus("")
    try {
      await navigator.clipboard.writeText(aggregateAudit)
      setShowAuditFallback(false)
      setAuditCopyStatus("Aggregate counts copied. No Facebook text or filenames included.")
    } catch {
      setShowAuditFallback(true)
      setAuditCopyStatus("Clipboard unavailable. Select and copy the aggregate-only summary shown below.")
    }
  }

  function toggleSignal(id: OwnerWritingSignalId) {
    if (!preview) return
    const next = selectedSignals.includes(id) ? selectedSignals.filter((value) => value !== id) : [...selectedSignals, id]
    setSelectedSignals(next)
    setDraft(buildOwnerWritingProfileDraft(preview.samples, signals.filter((signal) => next.includes(signal.id))))
    setReviewed(false)
    setProposed(false)
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

  async function proposeInteractionPreference() {
    const preference = interactionPreference.trim()
    if (!preview || interactionProposed || !interactionOptIn || preference.length < 15 ||
        preference.length > 350 || busy) return
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
          kind: "interaction-preference",
          preference,
          reviewed: true,
          interactionOptIn: true,
          sourceCount: preview.samples.length,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Could not propose interaction preference")
      setInteractionProposed(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not propose interaction preference")
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
        <p className="jh-card-copy">Choose up to six ZIP or supported JSON files at once. Older and newer exports are deduplicated and sampled across years. Large archives may require smaller date ranges.</p>
        <div style={{ marginTop: 16 }}>
          <p className="jh-label" style={{ marginBottom: 10 }}>Facebook export file</p>
          <label className="jh-button jh-button--primary" style={{
            display: "inline-flex", position: "relative", overflow: "hidden",
            alignItems: "center", justifyContent: "center", minHeight: 54,
            width: "100%", maxWidth: 400, padding: "14px 20px", textAlign: "center",
            touchAction: "manipulation", cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.55 : 1,
          }}>
            <span aria-hidden="true">{busy ? "Reading your local export…" : "Choose Facebook ZIP or JSON from Files"}</span>
            <input
              aria-label="Choose Facebook ZIP or JSON from Files"
              type="file"
              multiple
              disabled={busy}
              // No MIME filter: iPhone Files/Google Drive may expose ZIP as
              // octet-stream, and Safari otherwise greys out a valid archive.
              // previewFacebookExports enforces .zip/.json and all content caps.
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                opacity: 0.001, cursor: "pointer", fontSize: 18,
              }}
              onChange={(event) => {
                const chosen = Array.from(event.currentTarget.files ?? [])
                event.currentTarget.value = ""
                void onFiles(chosen)
              }}
            />
          </label>
          <p className="jh-meta" style={{ marginTop: 10 }}>
            On iPhone, tap the button, choose Browse, then select the ZIP from
            Google Drive or On My iPhone in Files. Other file types will be rejected
            locally. The archive is never uploaded.
          </p>
        </div>
        {busy && activeImport.current ? <div><p className="jh-meta" role="status">Reading selected writing locally… {progress}</p><button className="jh-button" type="button" onClick={() => { activeImport.current?.abort(); activeImport.current = null; setBusy(false); setProgress(""); setError("Import cancelled; no data was submitted.") }}>Cancel import</button></div> : null}
        {error ? <p className="jh-error" role="alert">{error}</p> : null}
        {zipDiagnostic ? <section style={{ marginTop: 14 }} aria-label="Local ZIP diagnostic">
          <p className="jh-label">ZIP metadata only</p>
          <p className="jh-meta">The v2 diagnostic includes a fixed failure code and last scanning phase alongside the original ZIP metadata. It does not include Facebook writing or filenames. The declared offset may remain out of bounds even after recovery was attempted.</p>
          <button className="jh-button" type="button" onClick={() => {
            void navigator.clipboard.writeText(zipDiagnostic).catch(() => undefined)
          }}>Copy ZIP diagnostic counts</button>
          <textarea className="jh-input" readOnly rows={10} aria-label="Copy local ZIP diagnostic"
            value={zipDiagnostic} onFocus={(event) => event.currentTarget.select()}
            style={{ width: "100%", marginTop: 10, fontFamily: "monospace", fontSize: 12 }} />
        </section> : null}
        {preview ? <div style={{ marginTop: 16 }}>
          <p className="jh-meta">{filename}: {preview.samples.length} distinct self-written entries identified across {preview.filesRead} JSON files.</p>
          {preview.truncated ? <p className="jh-error">This is a partial preview due to file size, sample caps or safety limits. Do not treat these numbers as a complete account history.</p> : null}
          <h3 className="jh-card-title" style={{ marginTop: 14 }}>Sampled writing by year</h3>
          <p className="jh-meta">Counts are from the selected, bounded local preview—not total activity or complete account coverage. A missing year may reflect export selection or safety limits.</p>
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead><tr><th scope="col">Year</th><th scope="col">Posts</th><th scope="col">Comments</th><th scope="col">Sampled total</th></tr></thead>
              <tbody>{coverage.map((item) => <tr key={item.year}>
                <th scope="row">{item.year}</th><td>{item.posts}</td><td>{item.comments}</td><td>{item.entries}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div style={{ marginTop: 16 }}>
            <button type="button" className="jh-button" onClick={() => { void copyLocalAudit() }}>
              Copy aggregate audit counts
            </button>
            <p className="jh-meta" style={{ marginTop: 8 }}>
              This copies only counts by year, preview limits and skipped-file totals. No writing, original filenames or Drive links are included.
            </p>
            {auditCopyStatus ? <p className="jh-meta" role="status">{auditCopyStatus}</p> : null}
            {showAuditFallback ? <textarea className="jh-input" readOnly aria-label="Aggregate audit counts"
              value={aggregateAudit} rows={8} onFocus={(event) => event.currentTarget.select()} /> : null}
          </div>
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
        {signals.length ? <section className="jh-list" aria-label="Optional writing cues" style={{ marginTop: 16 }}>
          <p className="jh-card-copy">Choose which observable cues should appear in your draft. Examples and excerpts stay local.</p>
          {signals.map((signal) => <label className="jh-item" key={signal.id} style={{ display: "flex", gap: 10, alignItems: "start" }}>
            <input type="checkbox" checked={selectedSignals.includes(signal.id)} onChange={() => toggleSignal(signal.id)} />
            <span><strong>{signal.label}</strong> · {signal.count} of {signal.denominator} entries · {signal.confidence} coverage
              <span className="jh-card-copy" style={{ display: "block" }}>{signal.explanation}</span>
            </span>
          </label>)}
        </section> : <p className="jh-meta">This sample is too small to report recurring writing cues. You can still review a descriptive owner note.</p>}
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
          <button className="jh-button" type="button" disabled={busy} onClick={() => { activeImport.current?.abort(); activeImport.current = null; setPreview(null); setSelectedSignals([]); setDraft(""); setReviewed(false); setProposed(false); setInteractionPreference(""); setInteractionOptIn(false); setInteractionProposed(false); setAuditCopyStatus(""); setShowAuditFallback(false); setFilename(""); setProgress(""); setError("") }}>
            Clear preview
          </button>
          {proposed ? <Link className="jh-button" href="/approvals">Open Approval Center</Link> : null}
        </div>
        {proposed ? <p className="jh-meta" role="status">Your note is pending approval. No Facebook data has been admitted to Jhadina&apos;s personality state.</p> : null}
        <div style={{ marginTop: 24 }}>
          <h3 className="jh-card-title">Optional: How should Jhadina talk with you?</h3>
          <p className="jh-card-copy">
            Facebook writing observations do not change her responses automatically. If you want
            an interaction preference, write it yourself. It will need separate approval and
            never overrides her safety rules or independent judgment.
          </p>
          <label style={{ display: "block", marginTop: 14 }}>
            <span className="jh-label">Your preferred conversation style (15–350 characters)</span>
            <textarea className="jh-input" aria-label="Your explicit Jhadina interaction preference"
              rows={3} maxLength={350} value={interactionPreference}
              disabled={busy || interactionProposed}
              placeholder="For example: Keep it conversational and direct, challenge weak ideas, and only use humor when it fits."
              onChange={(event) => { setInteractionPreference(event.target.value); setInteractionOptIn(false) }} />
          </label>
          <label style={{ display: "flex", alignItems: "start", gap: 8, marginTop: 12 }}>
            <input type="checkbox" checked={interactionOptIn} disabled={busy || interactionProposed}
              onChange={(event) => setInteractionOptIn(event.target.checked)} />
            <span className="jh-card-copy">I chose this instruction myself. Submit it as a separate interaction preference for my approval, not as a trait inferred from Facebook.</span>
          </label>
          <div style={{ marginTop: 14 }}>
            <button className="jh-button" type="button"
              disabled={busy || interactionProposed || !interactionOptIn || interactionPreference.trim().length < 15}
              onClick={() => { void proposeInteractionPreference() }}>
              {interactionProposed ? "Interaction preference proposed" : "Propose conversation preference"}
            </button>
          </div>
          {interactionProposed ? <p className="jh-meta" role="status">Pending your approval in the <Link href="/approvals">Approval Center</Link>. It is not active yet.</p> : null}
        </div>
      </div> : null}
      <p className="jh-meta" style={{ marginTop: 20 }}>
        This import does not connect to Facebook, scrape accounts, ingest Messenger,
        store your ZIP, train a model, or rewrite Jhadina&apos;s own personality.
        Approved owner notes enter existing Memory governance; richer Pattern learning
        requires a separately verified integration.
      </p>
      <Link href="/memory" className="jh-button" style={{ marginTop: 12, display: "inline-block" }}>Back to Memory</Link>
    </div></main>
  )
}
