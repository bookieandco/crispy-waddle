import {describe,expect,it} from "vitest"
import {
  candidateFromSearchResult,
  inferRecoverySourceKind,
  isGovernmentDomain,
  type RecoverySearchRequest,
} from "./source-discovery-provider.js"

const request: RecoverySearchRequest = {
  query: "CA department corrections inmate trust account unclaimed money",
  authorityRole: "STATE_DEPARTMENT_OF_CORRECTIONS",
  stateCode: "CA",
}

describe("recovery source discovery provider",()=>{
  it("recognizes government domains and source kinds",()=>{
    expect(isGovernmentDomain("https://www.cdcr.ca.gov/inmate-trust/")).toBe(true)
    expect(isGovernmentDomain("https://example.org/jail")).toBe(false)
    expect(inferRecoverySourceKind("https://example.gov/list.pdf")).toBe("PDF")
    expect(inferRecoverySourceKind("https://example.gov/claim-search","Claim Search")).toBe("PORTAL")
  })

  it("marks a relevant government source official but keeps access unapproved",()=>{
    const official=candidateFromSearchResult(request,{
      title:"Department of Corrections - Inmate Trust Account",
      url:"https://corrections.example.gov/inmate-trust/",
      snippet:"Information about inmate trust account balances and release funds.",
    })
    expect(official).not.toBeNull()
    expect(official?.officialSourceVerified).toBe(true)
    expect(official?.sourceKind).toBe("INFO_PAGE")
    expect(official?.accessReviewApproved).toBe(false)
  })

  it("does not treat unrelated government or private directory results as verified official sources",()=>{
    const unrelatedGov=candidateFromSearchResult(request,{
      title:"State Parks",
      url:"https://parks.example.gov/",
      snippet:"Find a state park.",
    })
    expect(unrelatedGov).not.toBeNull()
    expect(unrelatedGov?.officialSourceVerified).toBe(false)

    const privateDirectory=candidateFromSearchResult(request,{
      title:"Jail directory",
      url:"https://directory.example.org/jails",
      snippet:"Department of corrections inmate trust account directory.",
    })
    expect(privateDirectory).not.toBeNull()
    expect(privateDirectory?.officialSourceVerified).toBe(false)
  })

  it("rejects non-http search result URLs",()=>{
    expect(candidateFromSearchResult(request,{url:"javascript:alert(1)"})).toBeNull()
  })
})
