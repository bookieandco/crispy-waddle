import { describe, expect, it } from "vitest"
import { buildAdsConnectionReadiness, isAdsReadinessOwner } from "./ads-connection-readiness"

describe("ads connection readiness (read-only)", () => {
  it("rejects unconfigured, missing and foreign operator identity", () => {
    expect(isAdsReadinessOwner("owner-1", undefined)).toBe(false)
    expect(isAdsReadinessOwner("other-user", "owner-1")).toBe(false)
    expect(isAdsReadinessOwner(undefined, "owner-1")).toBe(false)
    expect(isAdsReadinessOwner("owner-1", "owner-1")).toBe(true)
  })

  it("fails closed without runtime credentials or approved budget ceilings", () => {
    const status = buildAdsConnectionReadiness({})
    expect(status.readOnly).toBe(true)
    expect(status.launchAuthorized).toBe(false)
    expect(status.meta.runtimeTokenPresent).toBe(false)
    expect(status.reddit.adsExecutionAdapterImplemented).toBe(false)
    expect(status.etsy.marketplaceApiKeyPresent).toBe(false)
    expect(status.spendGuard.configured).toBe(false)
  })

  it("never equates a Markifact token with Meta account authorization", () => {
    const status = buildAdsConnectionReadiness({
      MARKIFACT_MCP_ACCESS_TOKEN: "fake-test-token",
      GROWTH_AD_MAX_DAILY_BUDGET_MINOR: "100",
      GROWTH_AD_MAX_LIFETIME_BUDGET_MINOR: "1000",
    })
    expect(status.meta.runtimeTokenPresent).toBe(true)
    expect(status.meta.runtimeProviderCapabilityVerified).toBe(false)
    expect(status.meta.adAccountBindingVerified).toBe(false)
    expect(status.meta.instagramBindingVerified).toBe(false)
    expect(status.meta.execution).toBe("NOT_COMMISSIONED")
    expect(status.spendGuard.configured).toBe(true)
    expect(JSON.stringify(status)).not.toContain("fake-test-token")
    expect(status.launchAuthorized).toBe(false)
  })

  it("never treats an Etsy marketplace API key as an ads grant", () => {
    const status = buildAdsConnectionReadiness({ ETSY_API_KEY: "key:secret" })
    expect(status.etsy.marketplaceApiKeyPresent).toBe(true)
    expect(status.etsy.execution).toBe("RESEARCH_ONLY")
    expect(status.etsy.nativeAdsExecutionAdapterImplemented).toBe(false)
    expect(JSON.stringify(status)).not.toContain("key:secret")
  })

  it("distinguishes Artsy from Etsy and blocks missing Reddit paid adapter", () => {
    const status = buildAdsConnectionReadiness({})
    expect(status.artsy.integrationImplemented).toBe(false)
    expect(status.reddit.targetingAndDiagnosticsImplemented).toBe(true)
    expect(status.reddit.runtimeOAuthVerified).toBe(false)
  })

  it("rejects invalid ceiling relationships, nonintegers and invalid currency", () => {
    expect(buildAdsConnectionReadiness({
      GROWTH_AD_MAX_DAILY_BUDGET_MINOR: "250",
      GROWTH_AD_MAX_LIFETIME_BUDGET_MINOR: "100",
    }).spendGuard.configured).toBe(false)
    expect(buildAdsConnectionReadiness({
      GROWTH_AD_MAX_DAILY_BUDGET_MINOR: "0.5",
      GROWTH_AD_MAX_LIFETIME_BUDGET_MINOR: "100",
    }).spendGuard.configured).toBe(false)
    expect(buildAdsConnectionReadiness({
      GROWTH_AD_MAX_DAILY_BUDGET_MINOR: "100",
      GROWTH_AD_MAX_LIFETIME_BUDGET_MINOR: "1000",
      GROWTH_AD_BUDGET_CURRENCY: "DOLLARS",
    }).spendGuard.configured).toBe(false)
  })
})
