import { describe, expect, it } from "vitest"
import {
  assertNoClaimantIdentityInput,
  extractClaimantPolicyFacts,
  researchClaimantLifecyclePolicy,
} from "./lifecycle-policy-provider"

function response({
  url = "https://county.example.gov/refund",
  html,
  contentType = "text/html",
}: {
  url?: string
  html: string
  contentType?: string
}) {
  return {
    ok: true,
    status: 200,
    url,
    headers: { get: (name: string) => name.toLowerCase() === "content-type" ? contentType : null },
    text: async () => html,
  } as Response
}

describe("lifecycle policy research", () => {
  it("extracts claimant requirement categories without identity values", () => {
    const result = extractClaimantPolicyFacts(
      "Former inmates requesting a refund must provide a government-issued photo ID, booking number, and date of birth. An authorized representative may submit with power of attorney.",
    )
    expect(result.policyFacts.requirements_complete).toBe(true)
    expect(result.policyFacts.identity_documents_required).toContain("GOVERNMENT_ISSUED_ID")
    expect(result.policyFacts.custody_reference_types).toContain("BOOKING_NUMBER")
    expect(result.policyFacts.dob_may_be_used_for_corroboration).toBe(true)
    expect(result.policyFacts.skip_trace_auto_verifies_claimant).toBe(false)
    expect(result.policyFacts.protected_identity_values_stored_in_policy).toBe(false)
  })

  it("fails incomplete when the bound page has no identity-verification rule", () => {
    const result = extractClaimantPolicyFacts("Funds are returned after release.")
    expect(result.policyFacts.requirements_complete).toBe(false)
    expect(result.policyFacts.claimant_requirements_verified).toBe(false)
  })

  it("rejects claimant identity fields in the research request", () => {
    expect(() => assertNoClaimantIdentityInput({
      taskKey: "t",
      claimantName: "Do not accept this",
    })).toThrow(/LIFECYCLE_POLICY_PROTECTED_INPUT_PROHIBITED/)
  })

  it("researches only the exact bound official host and returns policy-only output", async () => {
    const calls: string[] = []
    const result = await researchClaimantLifecyclePolicy(
      {
        taskKey: "task-1",
        jurisdictionId: "06-085",
        authorityRole: "COUNTY_JAIL_OR_SHERIFF",
        sourceKey: "source-1",
        ruleFamily: "CLAIMANT",
        sourceUrl: "https://county.example.gov/refund",
        officialSourceVerified: true,
      },
      {
        now: "2026-10-05T00:30:00Z",
        fetchImpl: (async (url: string | URL | Request) => {
          calls.push(String(url))
          return response({
            html: "<html><body>To claim a commissary refund, provide a government-issued photo ID and booking number. Date of birth may be used if the booking number is unavailable.</body></html>",
          })
        }) as typeof fetch,
      },
    )

    expect(calls).toEqual(["https://county.example.gov/refund"])
    expect(result.authority).toBe("POLICY_RESEARCH_ONLY")
    expect(result.researchComplete).toBe(true)
    expect(result.claimantPiiPresent).toBe(false)
    expect(result.skipTraceUsed).toBe(false)
    expect(result.noExternalActionAuthority).toBe(true)
    expect(result.policyFacts.dob_may_be_used_for_corroboration).toBe(true)
  })

  it("rejects a cross-host redirect", async () => {
    await expect(researchClaimantLifecyclePolicy(
      {
        taskKey: "task-1",
        jurisdictionId: "06-085",
        authorityRole: "COUNTY_JAIL_OR_SHERIFF",
        sourceKey: "source-1",
        ruleFamily: "CLAIMANT",
        sourceUrl: "https://county.example.gov/refund",
        officialSourceVerified: true,
      },
      {
        fetchImpl: (async () => response({
          url: "https://other.example.gov/refund",
          html: "claim refund with photo ID",
        })) as typeof fetch,
      },
    )).rejects.toThrow("LIFECYCLE_POLICY_CROSS_HOST_REDIRECT_PROHIBITED")
  })
})
