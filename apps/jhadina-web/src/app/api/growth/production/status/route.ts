import { NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createGrowthProductionRepository } from "@/lib/growth/production-repository"
import { createPaidMediaProvider } from "@/lib/growth/paid-media-provider"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type GrowthHealth = {
  ready?: boolean
  schemaVersion?: string
  socialSchemaReady?: boolean
  eventIdempotencyReady?: boolean
  providerObservationIdempotencyReady?: boolean
  lifecycleApprovalMetadataReady?: boolean
}

function spendPolicyStatus() {
  const daily = Number(process.env.GROWTH_AD_MAX_DAILY_BUDGET_MINOR ?? "")
  const lifetime = Number(process.env.GROWTH_AD_MAX_LIFETIME_BUDGET_MINOR ?? "")
  const currency = (process.env.GROWTH_AD_BUDGET_CURRENCY ?? "USD").toUpperCase()
  return {
    configured:
      Number.isSafeInteger(daily) &&
      daily > 0 &&
      Number.isSafeInteger(lifetime) &&
      lifetime >= daily &&
      /^[A-Z]{3}$/.test(currency),
    currency,
  }
}

export async function GET() {
  try {
    const identity = await (await createRequestIdentityVerifier()).verify({})
    const repository = createGrowthProductionRepository()
    const campaigns = await repository.listPaidCampaigns(identity.userId)
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("jhadina_growth_runtime_health")
    if (error) throw new Error(`GROWTH_RUNTIME_HEALTH_FAILED:${error.message}`)
    const health = (data ?? {}) as GrowthHealth
    const spendPolicy = spendPolicyStatus()
    const provider = createPaidMediaProvider("markifact")
    const databaseReady =
      health.ready === true &&
      health.schemaVersion === "GROWTH-PROD-v2" &&
      health.eventIdempotencyReady === true &&
      health.providerObservationIdempotencyReady === true &&
      health.lifecycleApprovalMetadataReady === true
    const socialReady = health.socialSchemaReady === true
    const externalSpendReady = databaseReady && socialReady && spendPolicy.configured && provider.configured

    return NextResponse.json({
      success: externalSpendReady,
      data: {
        database: databaseReady ? "ready" : "blocked",
        schemaVersion: health.schemaVersion ?? null,
        social: socialReady ? "ready" : "blocked",
        governance: "ready",
        spendPolicy: spendPolicy.configured ? "ready" : "blocked_configuration",
        budgetCurrency: spendPolicy.currency,
        provider: provider.configured ? "ready" : "blocked_external_auth",
        providerName: provider.name,
        campaignCount: campaigns.length,
        productionReadyForExternalSpend: externalSpendReady,
      },
    }, { status: externalSpendReady ? 200 : 503 })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Growth production status unavailable",
    }, { status: 503 })
  }
}
