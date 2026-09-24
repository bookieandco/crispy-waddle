import { describe, expect, it } from "vitest"
import { createProductionSpatialContextProvider } from "./production-spatial-context-provider"
import { createSupabaseSpatialEvidenceStore } from "./supabase-spatial-evidence-store"
import { resolveServiceRoleConfig } from "../supabase/service-role"

const live = process.env.SATELLITE_LIVE_CERT === "1" ? describe : describe.skip

live("GEV satellite live certification", () => {
  it("reads real public satellite sources through the production Spatial factory and durably reads evidence back", async () => {
    const config = resolveServiceRoleConfig()
    const userId = "satellite-live-certification"
    const provider = createProductionSpatialContextProvider(userId, { timeoutMs: 12_000, maxEvidence: 30 })
    expect(provider).toBeDefined()

    const context = await provider!.getContext({
      userId,
      activeTask: "Show satellite imagery near LAX and the next approximate satellite overpass context.",
      geographicScope: {
        lat: 33.942501,
        lon: -118.407997,
        radiusKm: 25,
        resolvedPlace: {
          canonicalName: "Los Angeles International Airport",
          placeType: "airport",
          source: "OurAirports",
          sourceRef: "ourairports:KLAX",
          iata: "LAX",
          icao: "KLAX",
          confidence: 1,
        },
      },
    })

    expect(context).toBeDefined()
    expect(context!.evidence.length).toBeGreaterThan(1)
    expect(context!.claims).toHaveLength(0)
    expect(context!.reality).toHaveLength(0)

    const sources = new Set(context!.evidence.map((ref) => ref.source))
    expect(sources.has("CelesTrak")).toBe(true)
    expect(sources.has("NASA GIBS / Worldview")).toBe(true)

    const summaries = context!.evidence.map((ref) => ref.summary).join("\n")
    expect(summaries).toContain("CelesTrak orbit elements")
    expect(summaries).toContain("derived context-only")
    expect(summaries).toContain("NASA GIBS satellite imagery asset")

    console.log(JSON.stringify({
      certification: "GEV-SATELLITE-LIVE-PROVIDERS",
      status: "PASS",
      authority: "INTELLIGENCE_ONLY",
      scope: "LAX",
      evidenceCount: context!.evidence.length,
      sources: [...sources].sort(),
      checkedAt: new Date().toISOString(),
      commitSha: process.env.GITHUB_SHA ?? null,
    }))

    expect(config, "Supabase service-role configuration is required for durable live certification").not.toBeNull()

    const store = createSupabaseSpatialEvidenceStore()
    expect(store).toBeDefined()
    for (const ref of context!.evidence) {
      const durable = await store!.get(ref.id)
      expect(durable, `durable evidence missing: ${ref.id}`).toBeDefined()
      expect(durable!.integrity.contentHash).toMatch(/^[a-f0-9]{64}$/)
      expect(durable!.payload.attributes.realityAdmissionEligible).toBe(false)
    }

    expect(context!.limitations.some((item) => item.includes("non-admissible derived context"))).toBe(true)

    console.log(JSON.stringify({
      certification: "GEV-SATELLITE-LIVE",
      status: "PASS",
      authority: "INTELLIGENCE_ONLY",
      scope: "LAX",
      evidenceCount: context!.evidence.length,
      sources: [...sources].sort(),
      durableReadback: true,
      realityCount: context!.reality.length,
      claimCount: context!.claims.length,
      checkedAt: new Date().toISOString(),
      commitSha: process.env.GITHUB_SHA ?? null,
    }))
  }, 60_000)
})
