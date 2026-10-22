import { NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "private, no-store", "Pragma": "no-cache" }
const EXPECTED_PROJECT = "kqbkaozfjubkjevdfvic"

/**
 * Owner-phone acceptance probe. Deliberately performs only an authenticated
 * RLS-scoped HEAD SELECT; never invokes service-role, posting, DM, RPC,
 * migrations, OAuth, or any privileged runtime.
 */
export async function GET() {
  let ownerUserId: string
  try {
    const verifier = await createRequestIdentityVerifier()
    const identity = await verifier.verify({})
    if (!identity.userId) throw new Error("SOCIAL_SESSION_MISSING")
    ownerUserId = identity.userId
  } catch {
    return NextResponse.json(
      { success: false, error: "Sign in to Jhadina to test this device." },
      { status: 401, headers: NO_CACHE },
    )
  }

  try {
    const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim()
    if (!rawUrl || new URL(rawUrl).hostname !== EXPECTED_PROJECT + ".supabase.co") {
      return NextResponse.json(
        { success: false, error: "Jhadina is not pointed at the expected database." },
        { status: 503, headers: NO_CACHE },
      )
    }

    const supabase = await createClient()
    const { count, error } = await supabase
      .from("jhadina_social_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ownerUserId)

    if (error || typeof count !== "number" || count < 0) {
      throw new Error("SOCIAL_OWNER_RLS_READ_FAILED")
    }

    return NextResponse.json({
      success: true,
      checks: {
        authenticatedSession: "verified",
        expectedDatabase: "matched",
        accountRegistryRead: "verified",
        registeredAccountCount: count,
        // Flags are configuration evidence, not SQL GRANT or live authorization proof.
        rpcAuthority: process.env.JHADINA_SOCIAL_RPC_AUTHORITY_HARDENED === "true"
          ? "flag_on_requires_database_certification" : "off",
        studioPersistence: process.env.JHADINA_SOCIAL_STUDIO_STORAGE_ENABLED === "true"
          ? "flag_on_requires_database_certification" : "off",
        providerOAuth: "not_tested",
        privilegedProxy: "not_tested",
        humanPublicationApproval: "not_tested",
        livePublishing: "not_tested",
      },
    }, { headers: NO_CACHE })
  } catch {
    return NextResponse.json(
      { success: false, error: "Read-only Social acceptance could not complete." },
      { status: 503, headers: NO_CACHE },
    )
  }
}
