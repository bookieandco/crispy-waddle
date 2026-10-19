"use client"

import Link from "next/link"
import * as React from "react"
import { useMemo, useRef, useState } from "react"
import {
  buildFacebookReviewCandidates,
  clearFacebookReviewSession,
  transitionFacebookReviewSession,
  buildSelectedFacebookReviewDraft,
  formatFacebookReviewReceipt,
  prepareFacebookReviewItem,
  type FacebookReviewItem,
  type FacebookReviewDecision,
} from "@/lib/personality/facebook-owner-approval"
import { getCurrentUserId } from "@/lib/auth/current-user"
import { deriveOwnerWritingSignals } from "@/lib/personality/facebook-owner-signals"
import { deriveOwnerDeepWritingSignals } from "@/lib/personality/facebook-owner-deep-signals"
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
  const [reviewItems, setReviewItems] = useState<FacebookReviewItem[]>([])
  const [reviewReceiptStatus, setReviewReceiptStatus] = useState("")
  const [showReviewReceiptFallback, setShowReviewReceiptFallback] = useState(false)
  const [interactionPreference, setInteractionPreference] = useState("")
  const [interactionOptIn, setInteractionOptIn] = useState(false)
  const [interactionProposed, setInteractionProposed] = useState(false)
  const [auditCopyStatus, setAuditCopyStatus] = useState("")
  const [showAuditFallback, setShowAuditFallback] = useState(false)
  const signals = useMemo(() => preview ? deriveOwnerWritingSignals(preview.samples) : [], [preview])
  const deepSignals = useMemo(() => preview ? deriveOwnerDeepWritingSignals(preview.samples) : [], [preview])
  const coverage = React.useMemo(() => preview ? summarizeFacebookYears(preview.samples) : [], [preview])
  const observedCoverage = React.useMemo(() => preview?.observedYears ?? [], [preview])
  const aggregateAudit = useMemo(() => preview ? formatFacebookAuditSummary(preview) : "", [preview])
  // Recomputed from current decisions; never copies note text or raw Facebook data.
  const reviewReceipt = useMemo(() => formatFacebookReviewReceipt(reviewItems, interactionOptIn ? "selected" : "undecided"), [reviewItems, interactionOptIn])
  const activeImport = useRef<AbortController | null>(null)

  async function onFiles(files: readonly File[]) {
    activeImport.current?.abort()
    activeImport.current = null
    const cleared = clearFacebookReviewSession()
    setPreview(null)
    setReviewItems(cleared.items)
    setReviewReceiptStatus("")
    setShowReviewReceiptFallback(false)
    setDraft(cleared.draft)
    setFilename("")
    setProposed(cleared.proposed)
    setReviewed(cleared.reviewed)
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
      setReviewItems(buildFacebookReviewCandidates(result.samples).map((item) => ({
        id: item.id, label: item.label, note: item.proposedNote, decision: item.decision,
      })))
      // No auto-prepared memory note. Owner must choose cues or author it.
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

  function setCueReviewDecision(id: FacebookReviewItem["id"], decision: FacebookReviewDecision) {
    const next = transitionFacebookReviewSession(reviewItems, { type: "decision", id, decision })
    setReviewItems(next.items)
    setReviewReceiptStatus("")
    setShowReviewReceiptFallback(false)
    setDraft(next.draft)
    setReviewed(next.reviewed)
    setProposed(next.proposed)
  }

  function editCueReviewNote(id: FacebookReviewItem["id"], note: string) {
    const next = transitionFacebookReviewSession(reviewItems, { type: "edit", id, note })
    setReviewItems(next.items)
    setReviewReceiptStatus("")
    setShowReviewReceiptFallback(false)
    setDraft(next.draft)
    setReviewed(next.reviewed)
    setProposed(next.proposed)
  }

  function stageChosenReviewDraft() {
    // This is local-only. Owner must then read/edit and separately check the
    // existing reviewed box before any canonical pending proposal is possible.
    const prepared = reviewItems
      .map((item) => prepareFacebookReviewItem(item))
      .filter((item): item is FacebookReviewItem => item !== null)
    const note = buildSelectedFacebookReviewDraft(prepared)
    if (!note) { setError("Select at least one valid writing cue before preparing a local draft."); return }
    setDraft(note)
    setReviewed(false)
    setProposed(false)
    setError("")
  }

  async function copyReviewReceipt() {
    try {
      await navigator.clipboard.writeText(reviewReceipt)
      setShowReviewReceiptFallback(false)
      setReviewReceiptStatus("Only local decision counts copied. No writing or review notes included.")
    } catch {
      setShowReviewReceiptFallback(true)
      setReviewReceiptStatus("Clipboard unavailable. Select and copy the numeric-only receipt below.")
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
      <p className="jh-meta" role="note">Local ZIP reading, sample coverage and writing-cue review need no Jhadina account login on this private preview. Saving a pending Memory note is separate: it requires signing into Jhadina and explicit owner approval. Vercel private access may still require your project account.</p>
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
          <p className="jh-meta" style={{ marginBottom: 12 }}>
            Files stored in Google Drive?{" "}
            <a href="https://drive.google.com/drive/my-drive" target="_blank" rel="noopener noreferrer">
              Open Google Drive in a new tab
            </a>
            {" "}and locate the two posts JSON files and comments.json. Save copies to Files, return here, and select all three below.
            The link only opens Google Drive; your writing is read locally after you select files and is never uploaded by this importer.
          </p>
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
          <p className="jh-meta">{filename}: {preview.samples.length} distinct preview entries retained from {preview.filesRead} parsed JSON files.</p>
          <p className="jh-card-copy" role="status" style={{ marginTop: 10 }}>
            {preview.observedWritingEntries ?? "Unknown number of"} recognized writing entries examined in parsed, allowlisted JSON; {preview.samples.length} kept in the local sample (maximum 2,500).
            These are NOT your total Facebook posts and comments: unread files, other exports and duplicate texts can affect counts.
          </p>
          {preview.truncated ? <p className="jh-error">Partial preview: safety limits, bounded sampling or skipped files may limit coverage. No complete Facebook account history has been verified.</p> : null}
          {preview.filesSkipped ? <p className="jh-error" role="status">{preview.filesSkipped} eligible ZIP/JSON files were skipped or not processed. Counts do not include their contents.</p> : null}
          {preview.sampleLimitReached ? <p className="jh-meta" role="status">The 2,500-entry sampling cap was reached; the observed counts may be larger than the retained sample.</p> : null}
          {observedCoverage.length ? <div style={{ marginTop: 14 }}>
            <h3 className="jh-card-title">Recognized writing in processed JSON (not account totals)</h3>
            <p className="jh-meta">Numeric counts across successfully parsed eligible JSON only; duplicates across export shards can be counted more than once. No posts or private filenames are copied.</p>
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead><tr><th scope="col">Year</th><th scope="col">Posts recognized</th><th scope="col">Comments recognized</th><th scope="col">Recognized total</th></tr></thead>
                <tbody>{observedCoverage.map((year) => <tr key={year.year}>
                  <th scope="row">{year.year}</th><td>{year.posts}</td><td>{year.comments}</td><td>{year.entries}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </div> : null}
          <h3 className="jh-card-title" style={{ marginTop: 14 }}>Balanced local sample by year</h3>
          <p className="jh-meta">Numbers below reflect the retained, year/type-balanced samples, NOT actual post frequency. Sparse years and comments receive representation where qualifying writing exists. Missing years may reflect export selection or safety limits.</p>
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
              This copies scanned counts from parsed eligible JSON, bounded sample counts by year/type, skipped-file totals and limits only. No writing, original filenames or Drive links are included.
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
        <section className="jh-list" aria-label="Owner-only Facebook cue review" style={{ marginTop: 16 }}>
          <h3 className="jh-card-title">Review writing cues one by one (local only)</h3>
          <p className="jh-card-copy">
            These are descriptions of the bounded sample, not memories or instructions.
            Select, reject, or edit each cue. Nothing here is uploaded or saved by selecting it.
          </p>
          {reviewItems.length ? reviewItems.map((item) => <article className="jh-item" key={item.id}>
            <p className="jh-label">{item.label}</p>
            <textarea className="jh-input" rows={3} maxLength={900}
              aria-label={"Edit writing cue " + item.label} value={item.note}
              disabled={busy} onChange={(event) => editCueReviewNote(item.id, event.target.value)} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {(["selected", "rejected", "undecided"] as const).map((decision) =>
                <button type="button" key={decision} disabled={busy}
                  aria-pressed={item.decision === decision}
                  className="jh-button" onClick={() => setCueReviewDecision(item.id, decision)}>
                  {decision === "selected" ? "Keep in local draft" : decision === "rejected" ? "Reject cue" : "Undecided"}
                </button>)}
            </div>
          </article>) : <p className="jh-meta">No recurring cues found in this sample. You may still author a separate note.</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
            <button className="jh-button" type="button" disabled={busy || !reviewItems.some((item) => item.decision === "selected")}
              onClick={stageChosenReviewDraft}>Use selected cues in editable note (local only)</button>
            <button className="jh-button" type="button" disabled={busy || reviewItems.length === 0}
              onClick={() => { void copyReviewReceipt() }}>Copy numeric review receipt</button>
          </div>
          {reviewReceiptStatus ? <p role="status" className="jh-meta">{reviewReceiptStatus}</p> : null}
          {showReviewReceiptFallback ? <textarea className="jh-input" readOnly aria-label="Numeric-only review receipt" value={reviewReceipt} rows={8} onFocus={(event) => event.currentTarget.select()} /> : null}
          <p className="jh-meta">No automatic Memory creation. After preparing the note, separately review and explicitly submit it to the canonical Approval Center when authenticated. A preview-only Vercel session is not a Jhadina Memory login.</p>
        </section>
        {signals.length ? <section aria-label="Descriptive writing sample metrics" style={{ marginTop: 16 }}>
          <p className="jh-card-copy">Sample metrics below are informational. They do not select any memory for you.</p>
          {signals.map((signal) => <p className="jh-meta" key={signal.id}>
            <strong>{signal.label}</strong> · {signal.count} of {signal.denominator} sample entries · {signal.confidence} coverage
          </p>)}
        </section> : <p className="jh-meta">This sample is too small to report recurring writing cues. You can still write an owner note.</p>}
        <section aria-label="Deeper writing-form observations (local only)" style={{ marginTop: 20 }}>
          <h3 className="jh-card-title">Deeper writing patterns · local preview</h3>
          <p className="jh-card-copy">
            Counts use at most 2,500 distinct sampled entries, not your complete Facebook history.
            These fixed-rule hints describe phrasing, informal wording, reported dialogue, sequencing and possible humor forms.
            They cannot confirm sarcasm, wordplay, comedic timing, intentions, identity or personality.
            No post excerpts, private words or new Memory proposals are generated by these results.
          </p>
          {deepSignals.length ? <ul style={{ paddingLeft: 20 }}>
            {deepSignals.map((signal) => <li key={signal.id} className="jh-meta" style={{ marginTop: 10 }}>
              <strong>{signal.label}</strong> · {signal.count}/{signal.denominator} sampled entries
              {" "}({signal.posts} posts, {signal.comments} comments).
              {" "}{signal.explanation}
            </li>)}
          </ul> : <p className="jh-meta">No sufficiently repeated deep writing-form indicators in this sample.</p>}
          <p className="jh-meta">Read-only exploratory signals; review decisions above remain separate.
            Your writing never leaves this page through this analysis.</p>
        </section>
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
          <button className="jh-button" type="button" disabled={busy} onClick={() => { const cleared = clearFacebookReviewSession(); activeImport.current?.abort(); activeImport.current = null; setPreview(null); setReviewItems(cleared.items); setReviewReceiptStatus(""); setShowReviewReceiptFallback(false); setDraft(cleared.draft); setReviewed(cleared.reviewed); setProposed(cleared.proposed); setInteractionPreference(""); setInteractionOptIn(false); setInteractionProposed(false); setAuditCopyStatus(""); setShowAuditFallback(false); setFilename(""); setProgress(""); setError(""); setZipDiagnostic("") }}>
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
              onChange={(event) => { setInteractionPreference(event.target.value); setInteractionOptIn(false); setShowReviewReceiptFallback(false); setReviewReceiptStatus("") }} />
          </label>
          <label style={{ display: "flex", alignItems: "start", gap: 8, marginTop: 12 }}>
            <input type="checkbox" checked={interactionOptIn} disabled={busy || interactionProposed}
              onChange={(event) => { setInteractionOptIn(event.target.checked); setShowReviewReceiptFallback(false); setReviewReceiptStatus("") }} />
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
