import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createGrowthProductionRepository } from "@/lib/growth/production-repository"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    await (await createRequestIdentityVerifier()).verify({})
    const body = await req.json() as { brandId?: string; name?: string; kind?: string; definition?: Record<string, unknown> }
    if (!body.brandId || !body.name || !body.kind) {
      return NextResponse.json({ success: false, error: "brandId, name, and kind are required" }, { status: 400 })
    }
    const audience = await createGrowthProductionRepository().createAudience({
      brandId: body.brandId, name: body.name, kind: body.kind, definition: body.definition ?? {},
    })
    return NextResponse.json({ success: true, data: audience }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create audience"
    return NextResponse.json({ success: false, error: message }, { status: message.includes("Authenticated") ? 401 : 400 })
  }
}
