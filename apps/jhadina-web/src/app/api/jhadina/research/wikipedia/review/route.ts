import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { readWikipediaArticleDetails } from "@/lib/research/wikipedia-article-reader"
import { reviewPublicSourceCandidate } from "@/lib/research/wikipedia-primary-review"

export const dynamic = "force-dynamic"

/**
 * Owner-driven, read-only cross-source *candidate* comparison.
 * Re-read the Wikimedia page server-side; never trust a client URL.
 * Verdict never claims verified and cannot mutate canonical Knowledge.
 */
export async function POST(req: NextRequest) {
  const claimed = req.headers.get("x-jhadina-user-id") ?? ""
  if (!claimed) return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 })
  try {
    const verifier = await createRequestIdentityVerifier()
    await verifier.verify({ userId: claimed })
  } catch {
    return NextResponse.json({ success: false, error: "Not authorized" }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const id = body?.pageId
  const index = body?.candidateIndex
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(index) || index < 0 || index >= 12) {
    return NextResponse.json({ success: false, error: "Invalid article or reference selection" }, { status: 400 })
  }
  const detail = await readWikipediaArticleDetails(id)
  const candidate = detail?.externalLinkCandidates[index]
  if (!detail || !candidate) return NextResponse.json({ success: false, error: "Reference candidate unavailable" }, { status: 404 })
  const review = await reviewPublicSourceCandidate(detail.wikitextPreview, candidate)
  return NextResponse.json({
    success: true,
    data: { ...review, articleUrl: detail.articleUrl, inspectedAt: new Date().toISOString() },
  }, { headers: { "Cache-Control": "private, no-store" } })
}
