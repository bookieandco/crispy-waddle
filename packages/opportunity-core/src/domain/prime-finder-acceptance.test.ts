import assert from 'node:assert/strict'
import {certifyPrimeFinderPilot} from './prime-finder-acceptance.js'

const baseline=certifyPrimeFinderPilot({
  federalLatestScanSucceeded:false,subnetScanReceipts:0,activeSubnetListings:0,
  certifiedLocalAdapters:61,verifiedUniquePrimes:12,
  qualifiedPackageProviderMatches:0,primeSubRelationshipEdges:0,
  evidencedCommercialOutcomes:0,realSourcePilotPairs:0,unauthorizedOutreachActions:0,
})
assert.equal(baseline.status,'BLOCKED')
assert.equal(baseline.outreachAuthorized,false)
assert.ok(baseline.blockers.some(x=>x.includes('SUBNet')))
assert.equal(certifyPrimeFinderPilot({
  federalLatestScanSucceeded:true,subnetScanReceipts:1,activeSubnetListings:3,
  certifiedLocalAdapters:1,verifiedUniquePrimes:3,qualifiedPackageProviderMatches:3,
  primeSubRelationshipEdges:3,evidencedCommercialOutcomes:1,realSourcePilotPairs:3,
  unauthorizedOutreachActions:0,
}).status,'EVIDENCE_ACCEPTED')
console.log('prime-finder pilot acceptance tests passed')
