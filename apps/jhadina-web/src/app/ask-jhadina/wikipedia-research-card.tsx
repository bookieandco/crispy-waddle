"use client"

import { useState } from "react"
import { getCurrentUserId } from "@/lib/auth/current-user"

export type WikipediaResearchView = {
  status: "ok" | "unavailable" | "rate_limited"
  articles: Array<{
    id: number
    title: string
    excerpt: string
    url: string
    revisionUrl?: string
    revisionId?: number
    revisionAt?: string
    retrievedAt: string
    license: string
  }>
  limitations: string[]
}

type CitationInspection = {
  pageId: number
  title: string
  articleUrl: string
  retrievedAt: string
  referenceSnippets: string[]
  externalLinkCandidates: string[]
  limitations: string[]
  reviewStatus: "UNVERIFIED_REFERENCE_CANDIDATES"
}

/** No arbitrary citation destinations: the UI only opens trusted article links. */
export function wikipediaCitationUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return
  try {
    const u = new URL(raw)
    if (u.protocol !== "https:" || u.hostname !== "en.wikipedia.org" || u.username || u.password) return
    if (!u.pathname.startsWith("/wiki/") && u.pathname !== "/w/index.php") return
    return u.toString()
  } catch { return }
}

/** Inspected outbound citations are *candidates*: no auto-open or auto-fetch. */
export function safeReferenceLink(raw: unknown): string | undefined {
  if (typeof raw !== "string") return
  try {
    const u = new URL(raw)
    if (u.protocol !== "https:" || u.username || u.password) return
    if (!u.hostname.includes(".") || u.hostname === "localhost" || u.hostname.endsWith(".local")) return
    return u.toString()
  } catch { return }
}

export function WikipediaResearchCard({ research }: { research: WikipediaResearchView }) {
  const [inspection, setInspection] = useState<CitationInspection | null>(null)
  const [activePage, setActivePage] = useState<number | null>(null)
  const [inspectionError, setInspectionError] = useState("")
  const [loading, setLoading] = useState(false)
  async function inspect(pageId: number) {
    if (loading) return
    setLoading(true)
    setActivePage(pageId)
    setInspection(null)
    setInspectionError("")
    try {
      const userId = await getCurrentUserId()
      if (!userId) throw new Error("Sign in to inspect citations")
      const response = await fetch("/api/jhadina/research/wikipedia/article?pageId=" + encodeURIComponent(String(pageId)), {
        headers: { "x-jhadina-user-id": userId },
        cache: "no-store",
      })
      const result = await response.json()
      if (!response.ok || !result?.success) throw new Error("Reference inspection unavailable")
      setInspection(result.data as CitationInspection)
    } catch {
      setInspectionError("Reference inspection is unavailable. Use the article link to review its original sources.")
    } finally {
      setLoading(false)
    }
  }
  return <section className="jh-section" aria-label="Wikipedia research sources" style={{ marginTop: 18 }}>
    <h2 className="jh-card-title">Wikipedia research sources</h2>
    <p className="jh-meta">Read-only public encyclopedia evidence · not independently verified · no personal Memory update</p>
    {research.status !== "ok" ? <p className="jh-card-copy" role="status">Wikipedia is {research.status === "rate_limited" ? "temporarily rate-limited" : "unavailable"}; the response must not imply live sources were obtained.</p> : null}
    <div className="jh-list">
      {research.articles.map(article => {
        const href = wikipediaCitationUrl(article.revisionUrl) ?? wikipediaCitationUrl(article.url)
        return <article className="jh-item" key={article.id}>
          <strong>{article.title}</strong>
          <p className="jh-card-copy">{article.excerpt}</p>
          <p className="jh-meta">Wikipedia · retrieved {article.retrievedAt.slice(0, 10)} · revision {article.revisionId ?? "unknown"} · CC BY-SA</p>
          <div className="jh-row" style={{ marginTop: 8 }}>
            {href ? <a className="jh-button" href={href} target="_blank" rel="noopener noreferrer">Open revision <span aria-hidden>↗</span></a> : null}
            <button type="button" className="jh-button" disabled={loading} onClick={() => void inspect(article.id)}>Inspect references</button>
          </div>
          {activePage === article.id ? <div style={{ marginTop: 10 }}>
            {loading ? <p className="jh-meta" role="status">Inspecting public references…</p> : null}
            {inspectionError ? <p className="jh-meta" role="status">{inspectionError}</p> : null}
            {inspection?.pageId === article.id ? <>
              <p className="jh-meta">Citation candidates only; an article reference is not independent corroboration.</p>
              {inspection.referenceSnippets.map((s, i) => <p className="jh-card-copy" key={i}>{s}</p>)}
              {inspection.externalLinkCandidates.map((u, i) => safeReferenceLink(u) ? <p key={i}><a href={safeReferenceLink(u)} target="_blank" rel="noopener noreferrer">Reference candidate {i + 1} ↗</a></p> : null)}
              {inspection.referenceSnippets.length === 0 && inspection.externalLinkCandidates.length === 0 ? <p className="jh-meta">No reference candidates returned.</p> : null}
            </> : null}
          </div> : null}
        </article>
      })}
    </div>
    {research.limitations.map((limitation, i) => <p key={i} className="jh-meta">{limitation}</p>)}
  </section>
}
