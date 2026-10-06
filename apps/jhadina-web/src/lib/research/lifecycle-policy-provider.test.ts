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

  it("extracts entitlement requirement categories without verifying entitlement",()=>{
    const result=detectEntitlementPolicyFacts(
      "The owner or heir must file a signed and notarized claim form with proof of ownership. An authorized representative must provide power of attorney."
    )
    expect(result.researchComplete).toBe(true)
    expect(result.policyFacts.entitlement_requirements_verified).toBe(true)
    expect(result.policyFacts.claim_form_required).toBe(true)
    expect(result.policyFacts.signature_required).toBe(true)
    expect(result.policyFacts.notarization_required).toBe(true)
    expect(result.policyFacts.claimant_categories).toEqual(
      expect.arrayContaining(["OWNER","HEIR_OR_ESTATE","REPRESENTATIVE"])
    )
    expect(result.policyFacts.support_document_categories).toEqual(
      expect.arrayContaining(["CLAIM_FORM","PROOF_OF_OWNERSHIP","REPRESENTATIVE_AUTHORITY"])
    )
    expect(result.policyFacts.human_entitlement_decision_required).toBe(true)
    expect(result.policyFacts.result_verifies_entitlement).toBe(false)
    expect(result.policyFacts.protected_identity_values_stored_in_policy).toBe(false)
  })

  it("extracts sale-date deadline windows as policy facts only",()=>{
    const result=detectDeadlinePolicyFacts(
      "A claim must be filed within 2 years after the tax sale date."
    )
    expect(result.researchComplete).toBe(true)
    expect(result.policyFacts.deadline_rule_verified).toBe(true)
    expect(result.policyFacts.deadline_window_value).toBe(2)
    expect(result.policyFacts.deadline_window_unit).toBe("YEARS")
    expect(result.policyFacts.deadline_trigger).toBe("SALE_DATE")
    expect(result.policyFacts.fixed_deadline_date).toBeNull()
    expect(result.policyFacts.human_entitlement_decision_required).toBe(true)
    expect(result.policyFacts.result_verifies_entitlement).toBe(false)
  })

  it("keeps notice-based deadline triggers unresolved for downstream human review",()=>{
    const result=detectDeadlinePolicyFacts(
      "Claims must be filed within 30 days after notice is mailed."
    )
    expect(result.researchComplete).toBe(true)
    expect(result.policyFacts.deadline_window_value).toBe(30)
    expect(result.policyFacts.deadline_window_unit).toBe("DAYS")
    expect(result.policyFacts.deadline_trigger).toBe("NOTICE_DATE")
  })

  it("recognizes explicit no-deadline publication without inventing a date",()=>{
    const result=detectDeadlinePolicyFacts(
      "There is no statutory deadline to submit an excess proceeds claim."
    )
    expect(result.researchComplete).toBe(true)
    expect(result.policyFacts.no_deadline_published).toBe(true)
    expect(result.policyFacts.deadline_window_value).toBeNull()
    expect(result.policyFacts.deadline_window_unit).toBeNull()
    expect(result.policyFacts.fixed_deadline_date).toBeNull()
  })

  it("fetches entitlement policy only from the exact bound source host",async()=>{
    const entitlementRequest: LifecyclePolicyRequest = {
      ...request,
      taskKey:"task-entitlement",
      ruleFamily:"ENTITLEMENT",
      researchGoal:"Extract published entitlement requirements.",
    }
    const fetchImpl=vi.fn(async()=>new Response(
      "<html><body>Owner must submit a signed claim form and proof of ownership.</body></html>",
      {status:200,headers:{"content-type":"text/html"}},
    ))
    const result=await researchLifecyclePolicy(entitlementRequest, fetchImpl as typeof fetch)
    expect(result.researchComplete).toBe(true)
    expect(result.officialSourceRefs).toEqual([entitlementRequest.sourceUrl])
    expect(result.policyFacts).toMatchObject({
      human_entitlement_decision_required:true,
      result_verifies_entitlement:false,
      protected_identity_values_stored_in_policy:false,
    })
  })

  it("fetches deadline policy without claimant identity values",async()=>{
    const deadlineRequest: LifecyclePolicyRequest = {
      ...request,
      taskKey:"task-deadline",
      ruleFamily:"DEADLINE",
      researchGoal:"Extract published deadline rules.",
      requestedPolicyFields:[
        "deadline_window_value",
        "deadline_window_unit",
        "deadline_trigger",
      ],
    }
    const fetchImpl=vi.fn(async()=>new Response(
      "Claims must be filed within two years from the date of the tax sale.",
      {status:200,headers:{"content-type":"text/plain"}},
    ))
    const result=await researchLifecyclePolicy(deadlineRequest, fetchImpl as typeof fetch)
    expect(result.researchComplete).toBe(true)
    expect(result.policyFacts).toMatchObject({
      deadline_rule_verified:true,
      deadline_window_value:2,
      deadline_window_unit:"YEARS",
      deadline_trigger:"SALE_DATE",
      result_verifies_entitlement:false,
    })
    expect(JSON.stringify(deadlineRequest)).not.toContain("1970-01-01")
  })

  it("rejects unsupported rule families before fetching",async()=>{
    let calls=0
    await expect(researchLifecyclePolicy({
      ...request,
      ruleFamily:"OTHER" as LifecyclePolicyRequest["ruleFamily"],
    }, (async()=>{
      calls+=1
      return new Response("should not fetch")
    }) as typeof fetch)).rejects.toThrow(/REQUEST_INVALID/)
    expect(calls).toBe(0)
  })

})
