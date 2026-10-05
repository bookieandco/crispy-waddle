import {describe,expect,it,vi} from "vitest"
import {
  assertNoProtectedIdentityValues,
  detectClaimantPolicyFacts,
  researchLifecyclePolicy,
  type LifecyclePolicyRequest,
} from "./lifecycle-policy-provider.js"

const request: LifecyclePolicyRequest = {
  taskKey:"task-claimant",
  jurisdictionId:"06-085",
  authorityRole:"COUNTY_JAIL_OR_SHERIFF",
  sourceKey:"SOURCE-1",
  ruleFamily:"CLAIMANT",
  sourceUrl:"https://sheriff.example.gov/unclaimed-funds",
  authorityName:"Example Sheriff",
  officialSourceVerified:true,
  researchGoal:"Determine claimant verification requirements.",
  requestedPolicyFields:[
    "identity_documents_required",
    "custody_reference_types",
    "dob_may_be_used_for_corroboration",
  ],
}

describe("lifecycle policy provider",()=>{
  it("extracts only claimant requirement categories",()=>{
    const result=detectClaimantPolicyFacts(
      "Claimants must provide a government-issued photo ID, booking number, date of birth, and power of attorney for an authorized representative."
    )
    expect(result.researchComplete).toBe(true)
    expect(result.policyFacts.identity_documents_required).toContain("GOVERNMENT_ISSUED_ID")
    expect(result.policyFacts.custody_reference_types).toContain("BOOKING_NUMBER")
    expect(result.policyFacts.dob_may_be_used_for_corroboration).toBe(true)
    expect(result.policyFacts.human_verification_required).toBe(true)
    expect(result.policyFacts.skip_trace_auto_verifies_claimant).toBe(false)
    expect(result.policyFacts.protected_identity_values_stored_in_policy).toBe(false)
  })

  it("rejects protected claimant identity values in the research request",()=>{
    expect(()=>assertNoProtectedIdentityValues({
      ...request,
      dob:"1970-01-01",
    })).toThrow(/PROTECTED_FIELD_PROHIBITED/)
  })

  it("fetches only the exact bound source host and returns provenance",async()=>{
    const fetchImpl=vi.fn(async()=>new Response(
      "<html><body>Government issued ID and booking number are required.</body></html>",
      {
        status:200,
        headers:{"content-type":"text/html"},
      },
    ))
    Object.defineProperty(fetchImpl, "name", {value:"fetchImpl"})

    const result=await researchLifecyclePolicy(request, fetchImpl as typeof fetch)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      request.sourceUrl,
      expect.objectContaining({redirect:"follow",cache:"no-store"}),
    )
    expect(result.officialSourceRefs).toEqual([request.sourceUrl])
    expect(result.researchComplete).toBe(true)
  })

  it("fails closed when a fetch redirects to another host",async()=>{
    const response={
      ok:true,
      status:200,
      url:"https://other.example.gov/policy",
      headers:new Headers({"content-type":"text/plain"}),
      text:async()=>"photo id required",
    } as Response
    await expect(
      researchLifecyclePolicy(request, vi.fn(async()=>response) as unknown as typeof fetch)
    ).rejects.toThrow(/SOURCE_HOST_REDIRECT_REJECTED/)
  })
})
