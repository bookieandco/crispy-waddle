import { NextResponse } from "next/server"
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

function spendPolicyConfigured(): boolean {
  const daily = Number(process.env.GROWTH_AD_MAX_DAILY_BUDGET_MINOR ?? "")
  const lifetime = Number(process.env.GROWTH_AD_MAX_LIFETIME_BUDGET_MINOR ?? "")
  const currency = (process.env.GROWTH_AD_BUDGET_CURRENCY ?? "USD").toUpperCase()
  return Number.isSafeInteger(daily) && daily > 0
    && Number.isSafeInteger(lifetime) && lifetime >= daily
    && /^[A-Z]{3}$/.test(currency)
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("jhadina_growth_runtime_health")
    if (error) throw new Error(error.message)
    const health = (data ?? {}) as GrowthHealth
    const provider = createPaidMediaProvider("markifact")
    const gates = {
      growthSchema:
        health.ready === true &&
        health.schemaVersion === "GROWTH-PROD-v2" &&
        health.eventIdempotencyReady === true &&
        health.providerObservationIdempotencyReady === true &&
        health.lifecycleApprovalMetadataReady === true,
      socialSchema: health.socialSchemaReady === true,
      spendPolicy: spendPolicyConfigured(),
      paidProvider: provider.configured,
    }
    const ready = Object.values(gates).every(Boolean)
    return NextResponse.json({
      status: ready ? "READY" : "DEGRADED",
      schemaVersion: health.schemaVersion ?? null,
      gates,
    }, { status: ready ? 200 : 503 })
  } catch {
    return NextResponse.json({
      status: "DEGRADED",
      gates: { growthSchema: false, socialSchema: false, spendPolicy: false, paidProvider: false },
    }, { status: 503 })
  }
}
