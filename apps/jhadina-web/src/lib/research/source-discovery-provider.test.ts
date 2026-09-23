import { strict as assert } from "node:assert"
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

assert.equal(isGovernmentDomain("https://www.cdcr.ca.gov/inmate-trust/"), true)
assert.equal(isGovernmentDomain("https://example.org/jail"), false)
assert.equal(inferRecoverySourceKind("https://example.gov/list.pdf"), "PDF")
assert.equal(inferRecoverySourceKind("https://example.gov/claim-search", "Claim Search"), "PORTAL")

const official = candidateFromSearchResult(request, {
  title: "Department of Corrections - Inmate Trust Account",
  url: "https://corrections.example.gov/inmate-trust/",
  snippet: "Information about inmate trust account balances and release funds.",
})
assert.ok(official)
assert.equal(official?.officialSourceVerified, true)
assert.equal(official?.sourceKind, "INFO_PAGE")
assert.equal(official?.accessReviewApproved, false)

const unrelatedGov = candidateFromSearchResult(request, {
  title: "State Parks",
  url: "https://parks.example.gov/",
  snippet: "Find a state park.",
})
assert.ok(unrelatedGov)
assert.equal(unrelatedGov?.officialSourceVerified, false)

const privateDirectory = candidateFromSearchResult(request, {
  title: "Jail directory",
  url: "https://directory.example.org/jails",
  snippet: "Department of corrections inmate trust account directory.",
})
assert.ok(privateDirectory)
assert.equal(privateDirectory?.officialSourceVerified, false)

assert.equal(candidateFromSearchResult(request, { url: "javascript:alert(1)" }), null)

console.log("Jhadina recovery source discovery provider tests passed")
