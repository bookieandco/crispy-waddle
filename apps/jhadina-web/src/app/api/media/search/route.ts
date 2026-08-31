import { NextRequest, NextResponse } from "next/server"
import { createMediaProviderRegistry } from "@jhadina/tv-core"

export const dynamic = "force-dynamic"

const MAX_QUERY_LENGTH = 200
const MAX_PROVIDER_IDS = 10

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  const providerIds = req.nextUrl.searchParams.getAll("provider").map((id) => id.trim()).filter(Boolean)

  if (!query) {
    return NextResponse.json({ success: false, error: "q is required" }, { status: 400 })
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ success: false, error: `q must be ${MAX_QUERY_LENGTH} characters or fewer` }, { status: 400 })
  }
  if (providerIds.length > MAX_PROVIDER_IDS) {
    return NextResponse.json({ success: false, error: `At most ${MAX_PROVIDER_IDS} providers may be requested` }, { status: 400 })
  }

  const registry = createMediaProviderRegistry({ youtubeApiKey: process.env.YOUTUBE_API_KEY })

  try {
    const results = await registry.search(query, providerIds.length ? providerIds : undefined)
    return NextResponse.json({
      success: true,
      data: {
        query,
        providers: registry.list().map((provider) => ({ id: provider.id, name: provider.name, capabilities: provider.capabilities })),
        results,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Media search failed"
    return NextResponse.json({ success: false, error: message }, { status: 502 })
  }
}
