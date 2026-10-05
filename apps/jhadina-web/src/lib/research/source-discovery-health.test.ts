import { describe, expect, it } from "vitest"
import { getRecoverySearchHealth } from "./source-discovery-health"

describe("recovery source discovery health", () => {
  it("reports configured without revealing credentials or issuing a query", () => {
    const health = getRecoverySearchHealth({
      WEB_SEARCH_URL: "https://search.example.test/v1/search",
      WEB_SEARCH_API_KEY: "secret-value",
    })

    expect(health).toEqual({
      searchConfigured: true,
      endpointConfigured: true,
      credentialConfigured: true,
      endpointHost: "search.example.test",
      endpointProtocol: "https:",
      noQueryExecuted: true,
      noExternalActionAuthority: true,
    })
    expect(JSON.stringify(health)).not.toContain("secret-value")
  })

  it("fails closed when endpoint or credential is missing", () => {
    expect(getRecoverySearchHealth({
      WEB_SEARCH_URL: "https://search.example.test",
    }).searchConfigured).toBe(false)

    expect(getRecoverySearchHealth({
      WEB_SEARCH_API_KEY: "present",
    }).searchConfigured).toBe(false)
  })

  it("rejects non-http search endpoints", () => {
    const health = getRecoverySearchHealth({
      WEB_SEARCH_URL: "file:///tmp/search",
      WEB_SEARCH_API_KEY: "present",
    })

    expect(health.endpointConfigured).toBe(false)
    expect(health.searchConfigured).toBe(false)
  })
})
