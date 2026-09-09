import { NextResponse } from "next/server"
import { createGrowthIdea, listGrowthIdeas } from "@/lib/growth/engine"
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user"
import type { GrowthBrand, GrowthPlatform } from "@/lib/growth/types"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { userId } = await requireAuthenticatedUser()
    return NextResponse.json({ success: true, data: { ideas: listGrowthIdeas(userId) } })
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireAuthenticatedUser()
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
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
}
