import { NextRequest, NextResponse } from "next/server"
import { MultiHopperDevnetReadOnlyClient } from "@jhadina/money-core"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const headers = { "Cache-Control": "no-store" }

export async function POST(req: NextRequest) {
  try {
    const client = await createClient()
    const { data, error } = await client.auth.getClaims()
    if (error || !data?.claims?.sub) {
      return NextResponse.json({ success: false, error: "Sign in to request a test quote." }, { status: 401, headers })
    }
    if (process.env.MULTIHOPPER_DEVNET_READONLY_ENABLED !== "true") {
      return NextResponse.json({ success: false, error: "AgentPay devnet quotes are not enabled." }, { status: 503, headers })
    }
    const key = process.env.MULTIHOPPER_DEVNET_API_KEY
    if (!key) {
      return NextResponse.json({ success: false, error: "AgentPay devnet test key is not configured." }, { status: 503, headers })
    }
    const payload: unknown = await req.json()
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ success: false, error: "Invalid quote request." }, { status: 400, headers })
    }
    const body = payload as Record<string, unknown>
    if (
      typeof body.tokenMint !== "string" ||
      typeof body.amountRaw !== "string" ||
      body.amountRaw.length > 40 ||
      typeof body.tokenDecimals !== "number" ||
      typeof body.hops !== "number"
    ) {
      return NextResponse.json({ success: false, error: "Invalid quote request." }, { status: 400, headers })
    }
    const hopper = new MultiHopperDevnetReadOnlyClient({ apiKey: key })
    const quote = await hopper.estimate({
      tokenMint: body.tokenMint,
      amountRaw: body.amountRaw,
      tokenDecimals: body.tokenDecimals,
      hops: body.hops,
    })
    return NextResponse.json({ success: true, data: quote }, { headers })
  } catch (error) {
    const code = error instanceof Error ? error.message : ""
    const invalid = /MULTIHOPPER_(MINT|AMOUNT|DECIMALS|HOPS)_INVALID/.test(code)
    // Do not reflect unexpected transport/provider error details or credentials.
    return NextResponse.json({
      success: false,
      error: invalid ? "Check the token mint, atomic amount, decimals and hop count." : "Devnet quote unavailable.",
    }, { status: invalid ? 400 : 502, headers })
  }
}
