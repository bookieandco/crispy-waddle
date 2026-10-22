"use client"

import Link from "next/link"
import { useState, type ChangeEvent } from "react"
import { getCurrentUserId } from "@/lib/auth/current-user"
import { mergeRoundOneLedgers, ROUND_ONE_FILE_LIMIT, type RoundOneLedger } from "@/lib/memory/round-one-interview"

/** Archive bytes stay in the browser. Only owner-selected answers become pending Memory. */
export default function RoundOneInterviewPage() {
  const [ledger, setLedger] = useState<RoundOneLedger | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    setSelected([]); setMessage(""); setError("")
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    try {
      if (files.length > 5 || files.some(file => file.size > ROUND_ONE_FILE_LIMIT || file.size < 2)) {
        throw new Error("Choose up to five private JSON archives, each under 256 KB")
      }
      const archives = await Promise.all(files.map(async file => JSON.parse(await file.text()) as unknown))
      // Retain previously loaded entries so an iPhone can add archives one at a time.
      // A rejected conflicting file leaves the earlier review intact.
      setLedger(mergeRoundOneLedgers(ledger ? [ledger, ...archives] : archives))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read the archives")
    } finally {
      event.target.value = ""
    }
  }
  function toggle(questionNumber: number) {
    setMessage(""); setError("")
    setSelected(numbers => numbers.includes(questionNumber)
      ? numbers.filter(n => n !== questionNumber) : [...numbers, questionNumber])
  }
  async function proposeSelected() {
    if (!ledger || selected.length === 0 || busy) return
    setBusy(true); setMessage(""); setError("")
    let submitted = 0
    try {
      const userId = await getCurrentUserId()
      if (!userId) throw new Error("Sign in to Jhadina before submitting memory proposals")
      for (const entry of ledger.entries.filter(item => selected.includes(item.questionNumber))) {
        const response = await fetch("/api/memory/interview/propose", {
          method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json", "x-user-id": userId },
          body: JSON.stringify({ reviewed: true, entry }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || ("Could not submit " + entry.questionId))
        submitted++
        setSelected(numbers => numbers.filter(n => n !== entry.questionNumber))
      }
      setMessage(String(submitted) + " answers are pending, not approved or active. Open Approval Center to decide.")
    } catch (cause) {
      setError(String(submitted) + " proposed; stopped safely. " +
        (cause instanceof Error ? cause.message : "Submission failed"))
    } finally {
      setBusy(false)
    }
  }
  return <main className="jh-page"><div className="jh-wrap">
    <p className="jh-eyebrow">Private Memory · Round 1</p>
    <h1 className="jh-title">Review the completed interview</h1>
    <p className="jh-copy">Round 1 ended at Question 120. Round 2 is deferred until a private Jhadina session passes memory recall and correction tests. Your answers are never bundled in the app or inferred from Facebook.</p>
    <div className="jh-card" style={{ marginTop: 18 }}>
      <label htmlFor="round-one-archive" className="jh-card-title">Load private Round 1 JSON archives</label>
      <input id="round-one-archive" aria-label="Private Round 1 interview archives"
        style={{ display: "block", marginTop: 12 }} type="file" multiple
        accept=".json,application/json" disabled={busy} onChange={event => void loadFile(event)}/>
      <p className="jh-meta">Select the Q1–Q94 and Q95–Q120 JSON files together, or one at a time. Identical duplicates are deduplicated; conflicts are rejected. Files stay in your browser until you deliberately select and submit individual answers for pending approval. Nothing is automatically approved.</p>
    </div>
    {error ? <div className="jh-error" role="alert">{error}</div> : null}
    {message ? <div role="status" className="jh-item">{message}</div> : null}
    {ledger ? <section className="jh-section">
      <div className="jh-between">
        <h2 className="jh-section-title">{ledger.entries.length} recovered direct answers</h2>
        <span className="jh-status">Round 1 closed</span>
      </div>
      <p className="jh-copy">Only answers present in your selected files are shown. Any missing numbers remain missing, not invented. Select what Jhadina may propose for long-term memory.</p>
      <div className="jh-list">{ledger.entries.map(entry => <article className="jh-item" key={entry.questionId}>
        <label style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <input type="checkbox" checked={selected.includes(entry.questionNumber)}
            disabled={busy} onChange={() => toggle(entry.questionNumber)}/>
          <span><strong>{entry.questionId} · {entry.topic}</strong>
            <span style={{ display: "block", whiteSpace: "pre-wrap", marginTop: 8 }}>Question summary (not a direct user quote): {entry.questionSummary}</span>
            <span style={{ display: "block", whiteSpace: "pre-wrap", marginTop: 8 }}>Verbatim answer: {entry.answer}</span>
          </span>
        </label>
      </article>)}</div>
      <div className="jh-row" style={{ marginTop: 18 }}>
        <button type="button" className="jh-button jh-button--primary"
          disabled={busy || selected.length === 0} onClick={() => void proposeSelected()}>
          {busy ? "Proposing…" : "Submit " + selected.length + " selected for memory approval"}
        </button>
        <Link className="jh-button" href="/approvals">Open Approval Center</Link>
      </div>
      <p className="jh-meta">Only selected entries become owner-scoped CONTEXT candidates. Existing correction, forget, and approved-recall paths remain unchanged. No personality-state mutation, publication, or deployment.</p>
    </section> : null}
    <div className="jh-row" style={{ marginTop: 20 }}><Link href="/memory" className="jh-button">Back to Memory</Link></div>
  </div></main>
}
