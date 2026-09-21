import { NextRequest, NextResponse } from "next/server"
import { requireRequestIdentity } from "@/lib/auth/request-user"
import { createGrowthIdea, listGrowthIdeas } from "@/lib/growth/engine"
import type { GrowthBrand, GrowthPlatform } from "@/lib/growth/types"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const identity = await requireRequestIdentity()
    return NextResponse.json({ success: true, data: { ideas: listGrowthIdeas(identity.userId) } })
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
    if (!body.title || !body.premise || !body.brand || !body.platforms?.length) {
      return NextResponse.json(
        { success: false, error: "title, premise, brand, and platforms are required" },
        { status: 400 },
      )
    }
    const idea = createGrowthIdea({
      userId: identity.userId,
      brand: body.brand as GrowthBrand,
      title: body.title,
      premise: body.premise,
      source: body.source || "JHADINA",
      platforms: body.platforms as GrowthPlatform[],
      score: Number(body.score ?? 50),
    })
    return NextResponse.json({ success: true, data: { idea } }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to create growth idea" },
      { status: 401 },
    )
  }
}
