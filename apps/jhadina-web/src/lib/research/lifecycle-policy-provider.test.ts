import {describe,expect,it,vi} from "vitest"
import {
  assertNoProtectedIdentityValues,
  detectClaimantPolicyFacts,
  detectEntitlementPolicyFacts,
  detectDeadlinePolicyFacts,
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

  it("extracts entitlement requirement categories without deciding entitlement",()=>{
    const result=detectEntitlementPolicyFacts(
      "The former owner must submit a signed and notarized claim form with proof of ownership. Heirs must include letters testamentary and an authorized representative may use a power of attorney."
    )
    expect(result.researchComplete).toBe(true)
    expect(result.policyFacts.claim_form_required).toBe(true)
    expect(result.policyFacts.notarization_required).toBe(true)
    expect(result.policyFacts.signature_required).toBe(true)
    expect(result.policyFacts.claimant_categories).toContain("OWNER")
    expect(result.policyFacts.claimant_categories).toContain("HEIR_OR_ESTATE")
    expect(result.policyFacts.support_document_categories).toContain("PROOF_OF_OWNERSHIP")
    expect(result.policyFacts.support_document_categories).toContain("AUTHORITY_DOCUMENT")
    expect(result.policyFacts.human_entitlement_decision_required).toBe(true)
    expect(result.policyFacts.result_verifies_entitlement).toBe(false)
  })

  it("extracts a bounded deadline rule without deciding case status",()=>{
    const result=detectDeadlinePolicyFacts(
      "A claim must be received within 2 years after the tax sale. A signed claim form is required."
    )
    expect(result.researchComplete).toBe(true)
    expect(result.policyFacts.deadline_rule_verified).toBe(true)
    expect(result.policyFacts.no_deadline_published).toBe(false)
    expect(result.policyFacts.deadline_window_value).toBe(2)
    expect(result.policyFacts.deadline_window_unit).toBe("YEARS")
    expect(result.policyFacts.deadline_trigger).toBe("SALE_DATE")
    expect(result.policyFacts.human_entitlement_decision_required).toBe(true)
    expect(result.policyFacts.result_verifies_entitlement).toBe(false)
  })

  it("runs entitlement research only against the exact bound source host",async()=>{
    const entitlementRequest: LifecyclePolicyRequest = {
      ...request,
      taskKey:"task-entitlement",
      ruleFamily:"ENTITLEMENT",
      researchGoal:"Determine published entitlement requirements.",
    }
    const fetchImpl=vi.fn(async()=>new Response(
      "<html><body>Former owners must submit a claim form with proof of ownership.</body></html>",
      {
        status:200,
        headers:{"content-type":"text/html"},
      },
    ))
    const result=await researchLifecyclePolicy(entitlementRequest, fetchImpl as typeof fetch)
    expect(result.researchComplete).toBe(true)
    expect(result.policyFacts).toMatchObject({
      entitlement_requirements_verified:true,
      human_entitlement_decision_required:true,
      result_verifies_entitlement:false,
    })
    expect(result.officialSourceRefs).toEqual([entitlementRequest.sourceUrl])
  })

})
