import { NextRequest, NextResponse } from "next/server"
import {
  SamGovConfigurationError,
  SamGovRequestError,
  searchSamGovOpportunities,
} from "@/lib/opportunities/samGovClient"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_LIMIT = 100

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const rawLimit = Number(searchParams.get("limit") ?? "25")
  const rawOffset = Number(searchParams.get("offset") ?? "0")

  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > MAX_LIMIT) {
    return NextResponse.json({ error: "limit must be an integer from 1 to 100" }, { status: 400 })
  }

  if (!Number.isInteger(rawOffset) || rawOffset < 0) {
    return NextResponse.json({ error: "offset must be a non-negative integer" }, { status: 400 })
  }

  try {
    const opportunities = await searchSamGovOpportunities({
      keyword: searchParams.get("keyword") ?? undefined,
      postedFrom: searchParams.get("postedFrom") ?? undefined,
      postedTo: searchParams.get("postedTo") ?? undefined,
      limit: rawLimit,
      offset: rawOffset,
    })

    return NextResponse.json({
      source: "sam.gov",
      count: opportunities.length,
      limit: rawLimit,
      offset: rawOffset,
      opportunities,
    })
  } catch (error) {
    if (error instanceof SamGovConfigurationError) {
      return NextResponse.json({ error: "SAM.gov integration is not configured" }, { status: 503 })
    }

    if (error instanceof SamGovRequestError) {
      return NextResponse.json({ error: "SAM.gov opportunity request failed" }, { status: 502 })
    }

    console.error("SAM.gov opportunity route failed", error)
    return NextResponse.json({ error: "Unable to retrieve SAM.gov opportunities" }, { status: 500 })
  }
}
