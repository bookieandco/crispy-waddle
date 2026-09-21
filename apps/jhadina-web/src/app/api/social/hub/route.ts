import { NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { buildSocialHub } from "@/lib/social/hub"
import { createSocialRepository } from "@/lib/social/repository"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const verifier = await createRequestIdentityVerifier()
    const identity = await verifier.verify({})
    const repository = createSocialRepository()
    const [accounts, proposals, outbox, observations] = await Promise.all([
      repository.listAccounts(identity.userId),
      repository.listProposals(identity.userId),
      repository.listOutbox(identity.userId),
      repository.listObservations(identity.userId),
    ])
    return NextResponse.json({
      success: true,
      data: buildSocialHub({ accounts, proposals, outbox, observations }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Social Hub"
    return NextResponse.json({ success: false, error: message }, { status: 401 })
  }
}
