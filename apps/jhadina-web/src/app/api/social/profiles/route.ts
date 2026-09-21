import { NextRequest, NextResponse } from "next/server"
import type { JhadinaBrand } from "@jhadina/social-core"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createSocialProviderForUser } from "@/lib/social/hootsuite-runtime"
import { createSocialRepository } from "@/lib/social/repository"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const verifier = await createRequestIdentityVerifier()
    const identity = await verifier.verify({})
    const accounts = await createSocialRepository().listAccounts(identity.userId)
    return NextResponse.json({ success: true, data: accounts })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to load social accounts" },
      { status: 401 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const verifier = await createRequestIdentityVerifier()
    const identity = await verifier.verify({})
    const body = await req.json() as { brand?: JhadinaBrand; providerProfileId?: string }
    if (!body.brand || !body.providerProfileId) {
      return NextResponse.json(
        { success: false, error: "brand and providerProfileId are required" },
        { status: 400 },
      )
    }

    const provider = createSocialProviderForUser(identity.userId, "hootsuite")
    const profiles = await provider.discoverProfiles()
    const profile = profiles.find((candidate) => candidate.id === body.providerProfileId)
    if (!profile) {
      return NextResponse.json({ success: false, error: "Provider profile was not found" }, { status: 404 })
    }

    const account = await createSocialRepository().registerAccount({
      userId: identity.userId,
      brand: body.brand,
      provider: provider.name,
      providerProfileId: profile.id,
      platform: profile.platform,
      displayName: profile.name,
      handle: profile.handle,
    })

    return NextResponse.json({ success: true, data: account }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to register social account"
    const status = message.includes("OWNER") || message.includes("Authenticated") || message.includes("session") ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
