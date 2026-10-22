import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { readWikipediaArticleDetails } from "@/lib/research/wikipedia-article-reader"

export const dynamic = "force-dynamic"

/**
 * Owner-authenticated, read-only article citation candidates. No user URL,
 * non-Wikimedia network fetch, Memory write, admission or external execution.
 */
export async function GET(req: NextRequest) {
  const claimed = req.headers.get("x-jhadina-user-id") ?? ""
  if (!claimed) return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 })
  try {
    const identity = await createRequestIdentityVerifier()
    await identity.verify({ userId: claimed })
  } catch {
    return NextResponse.json({ success: false, error: "Not authorized" }, { status: 401 })
  }
  const raw = req.nextUrl.searchParams.get("pageId")
  if (!raw || !/^[1-9]\d{0,9}$/.test(raw)) {
    return NextResponse.json({ success: false, error: "A valid Wikipedia page ID is required" }, { status: 400 })
  }
  const detail = await readWikipediaArticleDetails(Number(raw))
  if (!detail) return NextResponse.json({ success: false, error: "Citation inspection unavailable" }, { status: 503 })
  return NextResponse.json({
    success: true,
    data: {
      pageId: detail.pageId,
      title: detail.title,
      articleUrl: detail.articleUrl,
      retrievedAt: detail.retrievedAt,
      referenceSnippets: detail.referenceSnippets,
      externalLinkCandidates: detail.externalLinkCandidates,
      limitations: detail.limitations,
      reviewStatus: "UNVERIFIED_REFERENCE_CANDIDATES",
    },
  }, { headers: { "Cache-Control": "private, no-store" } })
}
