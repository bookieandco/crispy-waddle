import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { getCanonicalMemoryStorage } from "@/lib/storage/createMemoryStorage"
import { parseReviewedOwnerNote, proposeReviewedFacebookOwnerNote } from "@/lib/personality/facebook-owner-proposal"

export const dynamic = "force-dynamic"

/** Only an owner-reviewed summary can cross the browser → server boundary. */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: "Same-origin request required" }, { status: 403 })
  }
  if (!(req.headers.get("content-type") ?? "").startsWith("application/json")) {
    return NextResponse.json({ error: "JSON request required" }, { status: 415 })
  }

  let note: ReturnType<typeof parseReviewedOwnerNote>
  try {
    const raw = await req.text()
    if (raw.length > 3000) return NextResponse.json({ error: "Review note too large" }, { status: 413 })
    note = parseReviewedOwnerNote(JSON.parse(raw) as unknown)
  } catch {
    return NextResponse.json({ error: "Valid reviewed summary required; do not send your raw Facebook archive or sensitive credentials" }, { status: 400 })
  }

  try {
    const verifier = await createRequestIdentityVerifier()
    const claimed = req.headers.get("x-user-id") ?? undefined
    const identity = await verifier.verify(claimed ? { userId: claimed } : {})
    const result = await proposeReviewedFacebookOwnerNote(getCanonicalMemoryStorage(), identity.userId, note)
    return NextResponse.json(
      { success: true, data: result },
      { headers: { "cache-control": "no-store" } },
    )
  } catch {
    // Never echo account claims, file content or provider internals in responses/logs.
    return NextResponse.json({ error: "Unable to save the owner note. Check sign-in and durable storage." }, { status: 503 })
  }
}
