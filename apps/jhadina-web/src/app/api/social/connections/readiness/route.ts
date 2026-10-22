import { NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createSocialRepository } from "@/lib/social/repository"
import { buildSocialConnectionReadiness } from "@/lib/social/connection-readiness"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const identity = await (await createRequestIdentityVerifier()).verify({})
    const accounts = await createSocialRepository().listAccounts(identity.userId)
    const data = buildSocialConnectionReadiness(identity.userId, accounts, process.env)
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } })
  } catch {
    // Never leak provider access keys, environment variable values, SQL or owner identifiers.
    return NextResponse.json({ success: false, error: "Social connection readiness is unavailable." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } })
  }
}
