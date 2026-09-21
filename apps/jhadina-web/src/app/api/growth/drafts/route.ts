import { NextRequest, NextResponse } from "next/server"
import { requireRequestIdentity } from "@/lib/auth/request-user"
import { createGrowthDraft, listGrowthDrafts } from "@/lib/growth/engine"
import type { ContentKind, GrowthBrand, GrowthPlatform } from "@/lib/growth/types"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const identity = await requireRequestIdentity()
    return NextResponse.json({ success: true, data: { drafts: listGrowthDrafts(identity.userId) } })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Authentication required" },
      { status: 401 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = await requireRequestIdentity()
    const body = await req.json()
    const draft = createGrowthDraft({
      userId: identity.userId,
      brand: body.brand as GrowthBrand,
      platforms: body.platforms as GrowthPlatform[],
      kind: body.kind as ContentKind,
      title: body.title,
      body: body.body,
      mediaIds: body.mediaIds,
      sourceAssetId: body.sourceAssetId,
      rationale: body.rationale || "Created in the Jhadina Growth Engine.",
      suggestedPublishAt: body.suggestedPublishAt,
      seo: body.seo,
    })
    return NextResponse.json({ success: true, data: { draft } }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to create growth draft" },
      { status: 401 },
    )
  }
}
