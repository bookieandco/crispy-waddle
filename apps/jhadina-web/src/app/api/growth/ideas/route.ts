import { NextRequest, NextResponse } from "next/server"
import { createGrowthIdea, listGrowthIdeas } from "@/lib/growth/engine"
import type { GrowthBrand, GrowthPlatform } from "@/lib/growth/types"
import { requireAuthenticatedUserId } from "@/lib/auth/require-authenticated-user"

export const dynamic = "force-dynamic"

export async function GET() {
  const userId = await requireAuthenticatedUserId()
  return NextResponse.json({
    success: true,
    data: { ideas: listGrowthIdeas(userId) },
  })
}

export async function POST(req: NextRequest) {
  const userId = await requireAuthenticatedUserId()
  const body = await req.json()
  if (!body.title || !body.premise || !body.brand || !body.platforms?.length) {
    return NextResponse.json({ success: false, error: "title, premise, brand, and platforms are required" }, { status: 400 })
  }

  const idea = createGrowthIdea({
    userId,
    brand: body.brand as GrowthBrand,
    title: body.title,
    premise: body.premise,
    source: body.source || "JHADINA",
    platforms: body.platforms as GrowthPlatform[],
    score: Number(body.score ?? 50),
  })

  return NextResponse.json({ success: true, data: { idea } }, { status: 201 })
}
