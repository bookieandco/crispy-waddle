import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { isAdsReadinessOwner } from "@/lib/growth/ads-connection-readiness"
import { MarkifactHttpTransport } from "@/lib/growth/markifact-mcp-transport"
import { checkMarkifactCampaignCapability } from "@/lib/growth/markifact-provider"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = (await (await createRequestIdentityVerifier()).verify({})).userId
  } catch {
    return NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401, headers })
  }
  const owner = process.env.JHADINA_ADS_OWNER_USER_ID?.trim()
  if (!owner) return NextResponse.json({ status: "ADS_OWNER_NOT_CONFIGURED" }, { status: 503, headers })
  if (!isAdsReadinessOwner(userId, owner)) {
    return NextResponse.json({ status: "FORBIDDEN" }, { status: 403, headers })
  }

  const channel = req.nextUrl.searchParams.get("channel")?.trim().toLowerCase() || "meta"
  if (channel !== "meta" && channel !== "google") {
    return NextResponse.json({ status: "UNSUPPORTED_CHANNEL", channel }, { status: 400, headers })
  }
  const token = process.env.MARKIFACT_MCP_ACCESS_TOKEN?.trim()
  if (!token) return NextResponse.json({
    status: "DEGRADED",
    configured: false,
    readyForPausedCampaignAcceptance: false,
    reason: "MARKIFACT_OAUTH_NOT_CONFIGURED",
  }, { status: 503, headers })

  try {
    const capability = await checkMarkifactCampaignCapability(
      new MarkifactHttpTransport({
        endpoint: process.env.MARKIFACT_MCP_URL?.trim() || "https://api.markifact.com/mcp",
        accessToken: token,
      }),
      channel,
    )
    const schemaReady = capability.approvalGated && capability.pausedFieldAvailable && capability.writeToolPresent
    return NextResponse.json({
      status: schemaReady ? "CAPABILITY_READY" : "DEGRADED",
      configured: true,
      channel,
      capability,
      readyForPausedCampaignAcceptance: schemaReady,
      accountBindingVerified: false,
      spendAuthorized: false,
      evidenceLevel: "provider_operation_schema_only",
    }, { status: schemaReady ? 200 : 503, headers })
  } catch {
    return NextResponse.json({
      status: "DEGRADED",
      configured: true,
      channel,
      readyForPausedCampaignAcceptance: false,
      accountBindingVerified: false,
      spendAuthorized: false,
      reason: "MARKIFACT_PREFLIGHT_FAILED",
    }, { status: 503, headers })
  }
}
