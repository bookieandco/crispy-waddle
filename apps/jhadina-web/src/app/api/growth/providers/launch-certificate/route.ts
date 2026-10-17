import { NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { buildAdsConnectionReadiness, isAdsReadinessOwner } from "@/lib/growth/ads-connection-readiness"
import { certifyAdsLaunchReadiness } from "@/lib/growth/ads-launch-certification"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "no-store" }

/**
 * Conservative live-environment inventory, not an execution endpoint.
 * A configured token never sets adAccountReadVerified, and inaccessible
 * Supabase remains unverified rather than fabricating a healthy DB.
 */
export async function GET() {
  let userId: string
  try {
    userId = (await (await createRequestIdentityVerifier()).verify({})).userId
  } catch {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401, headers })
  }
  const owner = process.env.JHADINA_ADS_OWNER_USER_ID
  if (!owner?.trim()) return NextResponse.json(
    { success: false, error: "ADS_OWNER_NOT_CONFIGURED" }, { status: 503, headers },
  )
  if (!isAdsReadinessOwner(userId, owner)) {
    return NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403, headers })
  }
  const readiness = buildAdsConnectionReadiness(process.env)
  const certificate = certifyAdsLaunchReadiness({
    ownerConfigured: true,
    providerTokenPresent: readiness.meta.runtimeTokenPresent,
    adAccountReadVerified: false,
    existingPausedCampaignReconciled: false,
    databaseReadHealthy: false,
    ownerIphoneAcceptanceVerified: false,
    budgetCeilingsConfigured: readiness.spendGuard.configured,
    ownerSpendApprovalPresent: false,
    creativeAndTrackingReviewed: false,
  })
  return NextResponse.json({
    success: true,
    auditScope: "SOURCE_AND_CONFIGURATION_ONLY",
    networkProbePerformed: false,
    meta: { tokenPresent: readiness.meta.runtimeTokenPresent, accountVerified: false },
    reddit: { adsExecutionImplemented: false },
    etsy: { publicMarketplaceResearchImplemented: true, sellerOAuthVerified: false },
    certificate,
  }, { headers })
}
