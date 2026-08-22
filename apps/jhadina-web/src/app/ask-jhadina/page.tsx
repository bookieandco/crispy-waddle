"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { getCurrentUserId } from "@/lib/auth/current-user"

type EvidenceRef = { id: string; source: string; observedAt: string; summary: string }
type DecisionProposal = {
  id: string
  disposition: "PROCEED" | "ASK" | "DECLINE" | "DEFER"
  recommendation: string
  rationale: string
  evidence: EvidenceRef[]
  uncertainty: string[]
  alternatives: string[]
}
type MemoryCandidate = { id: string; content: string; type: string; confidence: number; status: string }
type CommandResult = {
  proposal: DecisionProposal
  candidate?: MemoryCandidate
  approvalReceiptId?: string
  verified: boolean
  verificationReason?: string
}

/**
 * Phase 1 Step 6 — Ask Jhadina.
 *
 * Connects the app's ✦ shell to the real governed loop: this page is a
 * thin client for POST /api/jhadina/command (Step 6), which calls the
 * real handleJhadinaCommand() (Step 5) with no overrides — the real
 * Context Builder, the real IntelligenceRouter, the real
 * SecurityCoreActionPolicy/ApprovalReceipt/ActionExecutor/audit chain.
 * This page executes nothing directly and makes no policy decisions —
 * it only submits a command and renders what the governed pipeline
 * returned.
 *
 * A PROCEED disposition whose action succeeds produces a PENDING memory
 * candidate — Step 2's explicit human approval boundary is preserved
 * here exactly: the Approve/Reject buttons below call the same
 * pre-existing /api/memory/approve and /api/memory/reject routes Step 2
 * already built. Nothing on this page turns a proposal directly into a
 * durable memory.
 */
export default function AskJhadinaPage() {
  return (
    <Suspense fallback={null}>
      <AskJhadina />
    </Suspense>
  )
}

function AskJhadina() {
  const searchParams = useSearchParams()
  const surface = searchParams.get("surface") ?? "assistant"
  const route = searchParams.get("route") ?? "/ask-jhadina"

  const [activeTask, setActiveTask] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<CommandResult | null>(null)
  const [pending, setPending] = useState<MemoryCandidate[]>([])
  const [candidateBusy, setCandidateBusy] = useState<string | null>(null)

  async function userHeader(): Promise<Record<string, string>> {
    const userId = await getCurrentUserId()
    if (!userId) throw new Error("Not signed in")
    return { "x-jhadina-user-id": userId }
  }

  async function loadPending() {
    try {
      const headers = await userHeader()
      const res = await fetch("/api/candidates", { headers: { "x-user-id": headers["x-jhadina-user-id"] } })
      const json = await res.json()
      if (res.ok) setPending(json.data?.candidates ?? [])
    } catch {
      // Loading the pending list is a convenience, not the governed
      // action itself — a failure here doesn't block asking Jhadina.
    }
  }
  useEffect(() => { void loadPending() }, [])

  async function ask() {
    if (!activeTask.trim()) return
    setBusy(true); setError(""); setResult(null)
    try {
      const headers = await userHeader()
      const res = await fetch("/api/jhadina/command", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ activeTask: activeTask.trim(), surface, route }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Jhadina could not process that")
      setResult(json.data)
      setActiveTask("")
      await loadPending()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Jhadina could not process that")
    } finally {
      setBusy(false)
    }
  }

  async function decideCandidate(candidateId: string, decision: "approve" | "reject") {
    setCandidateBusy(candidateId)
    try {
      const headers = await userHeader()
      const res = await fetch(`/api/memory/${decision}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-user-id": headers["x-jhadina-user-id"] },
        body: JSON.stringify({ candidateId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not update memory")
      await loadPending()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update memory")
    } finally {
      setCandidateBusy(null)
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#f5f1ea,#edf2ed 55%,#f3eee8)", color: "#29332e", padding: "28px 18px 110px", fontFamily: 'ui-rounded,"Avenir Next",Avenir,system-ui,sans-serif' }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={eyebrow}>✦ Jhadina</div>
        <h1 style={{ margin: "12px 0 8px", fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 400, fontSize: "clamp(32px,8vw,52px)", letterSpacing: "-.045em", lineHeight: 1 }}>Ask Jhadina.</h1>
        <p style={{ margin: 0, color: "#718078", lineHeight: 1.65, maxWidth: 560 }}>
          Jhadina reasons, but never decides alone — every proposal passes through real policy and, where required, your explicit approval before anything happens.
        </p>

        <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
          <input
            value={activeTask}
            onChange={(e) => setActiveTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && ask()}
            placeholder="Tell Jhadina something…"
            style={{ flex: 1, minWidth: 0, borderRadius: 16, border: "1px solid #d6ddd7", padding: "13px 16px", background: "rgba(255,255,255,.8)", color: "#29332e", font: "inherit" }}
          />
          <button disabled={busy || !activeTask.trim()} onClick={ask} style={primary}>{busy ? "Thinking…" : "Ask"}</button>
        </div>

        {error && <div role="alert" style={{ marginTop: 16, padding: 13, borderRadius: 16, background: "#f5e1dc", color: "#8d5148" }}>{error}</div>}

        {result && (
          <section style={{ marginTop: 24, padding: 20, borderRadius: 22, background: "rgba(255,255,255,.78)", border: "1px solid #dce2dd" }}>
            <div style={eyebrow}>{result.proposal.disposition}</div>
            <p style={{ margin: "10px 0 8px", fontSize: 16, lineHeight: 1.6 }}>{result.proposal.recommendation}</p>
            <div style={{ padding: 13, borderRadius: 16, background: "#eef1ed", color: "#657169", fontSize: 13, lineHeight: 1.55 }}>
              <strong>Why:</strong> {result.proposal.rationale}
            </div>
            {result.approvalReceiptId && (
              <p style={{ marginTop: 10, fontSize: 12, color: "#8b7b9d" }}>
                This required approval — receipt {result.approvalReceiptId.slice(0, 8)}… granted for this request.
              </p>
            )}
            {!result.verified && (
              <p role="alert" style={{ marginTop: 10, fontSize: 12, color: "#8d5148" }}>
                Verification did not pass: {result.verificationReason}
              </p>
            )}
            {!result.candidate && (
              <p style={{ marginTop: 10, fontSize: 13, color: "#7d8982" }}>
                Nothing was executed for this request ({result.verificationReason ?? "no action was proposed"}).
              </p>
            )}
          </section>
        )}

        <section style={{ marginTop: 38 }}>
          <h2 style={heading}>Waiting on you</h2>
          {pending.length === 0 ? (
            <div style={{ padding: 20, borderRadius: 20, background: "rgba(255,255,255,.55)", border: "1px solid #dce2dd", color: "#68756e" }}>
              Nothing pending — anything Jhadina proposes to remember shows up here until you approve or reject it.
            </div>
          ) : (
            pending.map((candidate) => (
              <article key={candidate.id} style={{ padding: 18, marginBottom: 12, borderRadius: 22, background: "rgba(255,255,255,.72)", border: "1px solid #dce2dd" }}>
                <div style={eyebrow}>{candidate.type} · pending</div>
                <p style={{ margin: "8px 0 12px" }}>{candidate.content}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button disabled={candidateBusy === candidate.id} onClick={() => decideCandidate(candidate.id, "approve")} style={primary}>Approve</button>
                  <button disabled={candidateBusy === candidate.id} onClick={() => decideCandidate(candidate.id, "reject")} style={secondary}>Reject</button>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  )
}

const heading = { margin: "0 4px 14px", fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 400 as const, fontSize: 24 }
const eyebrow = { fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase" as const, color: "#77847c" }
const primary = { border: 0, borderRadius: 999, padding: "10px 17px", background: "#34443c", color: "#f8f6f1", fontWeight: 600, cursor: "pointer" }
const secondary = { border: "1px solid #d4dcd5", borderRadius: 999, padding: "9px 16px", background: "rgba(255,255,255,.5)", color: "#56635c", fontWeight: 600, cursor: "pointer" }
