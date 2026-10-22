import { NextRequest, NextResponse } from "next/server"
import {
  MAX_PUBLIC_SOURCES, mergePublicFeeds, publicFeedSource,
  type PublicFeedProvider,
} from "@jhadina/social-core"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { readPublicFeed } from "@/lib/social/public-feed-transport"

export const dynamic = "force-dynamic"
const NO_CACHE = { "Cache-Control": "private, no-store" }
const ALLOWED = new Set<string>(["github", "youtube", "wordpress"])

/** Read-only, ephemeral preview. No subscription writes, token access or posts. */
export async function GET(req: NextRequest) {
  try {
    const identity = await (await createRequestIdentityVerifier()).verify({})
    if (!identity.userId) throw new Error("INVALID_SESSION")
  } catch {
    return NextResponse.json({ success: false, error: "Sign in to preview your feeds." },
      { status: 401, headers: NO_CACHE })
  }
  const values = req.nextUrl.searchParams.getAll("source")
  // Reject URL-shaped input at the HTTP boundary, independently of the
  // canonical package validator. Handles/UC channel IDs never contain
  // dots, slashes, credentials, queries, anchors or backslashes.
  if (values.length < 1 || values.length > MAX_PUBLIC_SOURCES ||
      values.some(v => v.length > 100 || /[.\\/@?#]/.test(v))) {
    return NextResponse.json({ success: false, error: "Choose one to four public feed sources." },
      { status: 400, headers: NO_CACHE })
  }

  try {
    const unique = new Set<string>()
    const sources = values.map(value => {
      const colon = value.indexOf(":")
      const provider = value.slice(0, colon)
      if (colon < 1 || !ALLOWED.has(provider)) throw new Error("INVALID_FEED_SOURCE")
      const source = publicFeedSource(provider as PublicFeedProvider, value.slice(colon + 1))
      if (unique.has(source.label)) throw new Error("DUPLICATE_FEED_SOURCE")
      unique.add(source.label)
      return source
    })
    const results = await Promise.all(sources.map(source => readPublicFeed(source)))
    return NextResponse.json({
      success: true,
      data: {
        items: mergePublicFeeds(results, { limit: 24, minPerSource: 2, streakLimit: 2 }),
        sources: results.map(({source,state,items}) => ({
          provider:source.provider, identifier:source.identifier, state,
          itemCount:items.length,
        })),
        provenance: "official_public_feed",
        persisted: false,
        authorizedToPublish: false,
      },
    }, { headers: NO_CACHE })
  } catch {
    return NextResponse.json({
      success: false, error: "Feed source identifiers are invalid.",
    }, { status: 400, headers: NO_CACHE })
  }
}
