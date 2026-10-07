import {describe,expect,it} from "vitest"
import {
  buildRecoverySearchQuery,
  candidateFromSearchResult,
  extractPublicRecordsContactMetadata,
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

  it("verifies official tax-sale surplus sources for tax authority roles",()=>{
    const taxRequest: RecoverySearchRequest = {
      query:"Example County tax sale excess proceeds",
      authorityRole:"TAX_COLLECTOR",
      stateCode:"CA",
      countyName:"Example County",
    }
    const official=candidateFromSearchResult(taxRequest,{
      title:"Example County Tax Collector - Excess Proceeds",
      url:"https://tax.example.gov/excess-proceeds",
      snippet:"Tax sale excess proceeds and surplus funds claim information.",
    })
    expect(official?.officialSourceVerified).toBe(true)
    expect(official?.accessReviewApproved).toBe(false)
  })

  it("uses discovery hints only to sharpen the query",()=>{
    const query=buildRecoverySearchQuery({
      query:"site:.gov Example County CA sheriff jail inmate trust account",
      authorityRole:"COUNTY_JAIL_OR_SHERIFF",
      stateCode:"CA",
      countyName:"Example County",
      discoveryHints:[{
        name:"Example County Sheriff",
        url:"https://www.jail411.com/directory/example",
        allowedUse:"COUNTY_OPERATOR_AND_FACILITY_DISCOVERY_ONLY",
        requiresOfficialConfirmation:true,
      }],
    })
    expect(query).toContain("Example County Sheriff")
    const privateDirectory=candidateFromSearchResult({
      query,
      authorityRole:"COUNTY_JAIL_OR_SHERIFF",
      discoveryHints:[{name:"Example County Sheriff"}],
    },{
      title:"Example County Sheriff inmate trust account",
      url:"https://www.jail411.com/directory/example",
      snippet:"inmate trust account",
    })
    expect(privateDirectory?.officialSourceVerified).toBe(false)
  })

  it("recognizes official public-records pages without requiring tax-funds terms",()=>{
    const recordsRequest: RecoverySearchRequest = {
      query:"Example County public records request contact",
      authorityRole:"PUBLIC_RECORDS_OFFICER",
      stateCode:"CA",
      countyName:"Example County",
      desiredSourceTypes:["PUBLIC_RECORDS_CONTACT"],
    }
    const official=candidateFromSearchResult(recordsRequest,{
      title:"Example County Public Records Request",
      url:"https://records.example.gov/public-records",
      snippet:"Submit an open records request to the Records Custodian.",
      publishedAt:"2024-01-01T00:00:00.000Z",
    },"2026-10-07T02:30:00.000Z")
    expect(official?.officialSourceVerified).toBe(true)
    expect(official?.evidence.recordsRelevant).toBe(true)
    expect(official?.evidence.observedAt).toBe("2026-10-07T02:30:00.000Z")
    expect(official?.evidence.publishedAt).toBe("2024-01-01T00:00:00.000Z")
  })

  it("extracts only published public-business contact channels and hashes the official page",()=>{
    const metadata=extractPublicRecordsContactMetadata("https://records.example.gov/public-records",`<!doctype html>
      <html><head><title>Example County Treasurer - Public Records</title></head><body>
      <h1>Example County Treasurer Public Records</h1>
      <p>Public Records Officer</p>
      <p>Email your public records request to <a href="mailto:records@example.gov">records@example.gov</a>.</p>
      <p>Questions: <a href="tel:555-123-4567">555-123-4567</a></p>
      <p>You may also submit a public records request using our <a href="https://example.nextrequest.com/requests/new">request portal</a>.</p>
      </body></html>`)
    expect(metadata.email).toBe("records@example.gov")
    expect(metadata.phone).toBe("555-123-4567")
    expect(metadata.portalUrl).toBe("https://example.nextrequest.com/requests/new")
    expect(metadata.acceptedChannels).toEqual(["EMAIL","PORTAL"])
    expect(metadata.acceptsRecordsRequests).toBe(true)
    expect(metadata.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(metadata.notes).toMatch(/no inferred email address/i)
  })

  it("does not convert a visible staff email into an accepted records channel without explicit instructions",()=>{
    const metadata=extractPublicRecordsContactMetadata("https://treasurer.example.gov/contact",`<!doctype html>
      <html><head><title>Example County Treasurer</title></head><body>
      <h1>Public Records Information</h1>
      <p>General staff contact: <a href="mailto:jane.doe@example.gov">Jane Doe</a></p>
      <p>Call <a href="tel:555-222-3333">555-222-3333</a> for routing questions.</p>
      </body></html>`)
    expect(metadata.email).toBe("jane.doe@example.gov")
    expect(metadata.phone).toBe("555-222-3333")
    expect(metadata.acceptedChannels).toEqual([])
    expect(metadata.acceptsRecordsRequests).toBe(false)
  })

  it("rejects non-http search result URLs",()=>{
    expect(candidateFromSearchResult(request,{url:"javascript:alert(1)"})).toBeNull()
  })
})
