import { NextRequest, NextResponse } from "next/server"
import { createGrowthDraft, listGrowthDrafts } from "@/lib/growth/engine"
import type { ContentKind, GrowthBrand, GrowthPlatform } from "@/lib/growth/types"

export const dynamic = "force-dynamic"

function userId(req: NextRequest) { return req.headers.get("x-jhadina-user-id") || "default-user" }

export async function GET(req: NextRequest) {
  return NextResponse.json({ success: true, data: { drafts: listGrowthDrafts(userId(req)) } })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const draft = createGrowthDraft({
    userId: userId(req),
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
}
