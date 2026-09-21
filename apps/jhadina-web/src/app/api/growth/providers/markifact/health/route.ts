import { NextRequest, NextResponse } from "next/server"
import { MarkifactHttpTransport } from "@/lib/growth/markifact-mcp-transport"
import { checkMarkifactCampaignCapability } from "@/lib/growth/markifact-provider"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const token = process.env.MARKIFACT_MCP_ACCESS_TOKEN?.trim()
  if (!token) {
    return NextResponse.json({
      status: "DEGRADED",
      configured: false,
      readyForPausedCampaignAcceptance: false,
      reason: "MARKIFACT_OAUTH_NOT_CONFIGURED",
    }, { status: 503 })
  }

  const channel = req.nextUrl.searchParams.get("channel")?.trim().toLowerCase() || "meta"
  try {
    const capability = await checkMarkifactCampaignCapability(
      new MarkifactHttpTransport({
        endpoint: process.env.MARKIFACT_MCP_URL?.trim() || "https://api.markifact.com/mcp",
        accessToken: token,
      }),
      channel,
    )
    const ready =
      capability.approvalGated &&
      capability.pausedFieldAvailable &&
      capability.writeToolPresent

    return NextResponse.json({
      status: ready ? "READY" : "DEGRADED",
      configured: true,
      channel,
      capability,
      readyForPausedCampaignAcceptance: ready,
    }, { status: ready ? 200 : 503 })
  } catch (error) {
    return NextResponse.json({
      status: "DEGRADED",
      configured: true,
      channel,
      readyForPausedCampaignAcceptance: false,
      error: error instanceof Error ? error.message : "MARKIFACT_PREFLIGHT_FAILED",
    }, { status: 503 })
  }
}
