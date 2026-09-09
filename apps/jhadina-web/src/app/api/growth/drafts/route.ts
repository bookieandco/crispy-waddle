import { NextResponse } from "next/server"
import { createGrowthDraft, listGrowthDrafts } from "@/lib/growth/engine"
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user"
import type { ContentKind, GrowthBrand, GrowthPlatform } from "@/lib/growth/types"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { userId } = await requireAuthenticatedUser()
    return NextResponse.json({ success: true, data: { drafts: listGrowthDrafts(userId) } })
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireAuthenticatedUser()
    const body = await req.json()
    const draft = createGrowthDraft({
      userId,
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
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
}
