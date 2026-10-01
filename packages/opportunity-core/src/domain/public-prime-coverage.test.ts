import assert from 'node:assert/strict'
import {
  PUBLIC_PRIME_REQUIRED_LEVELS,
  assessPublicPrimeCoverage,
  type PublicPrimeCoverageMetrics,
} from './public-prime-coverage.js'

const partial:PublicPrimeCoverageMetrics={
  levels:[
    {level:'state',jurisdictionCount:51,jurisdictionsWithVerifiedAwardSource:51,jurisdictionsWithActiveAwardAdapter:51,jurisdictionsWithAwardObservation:30,jurisdictionsWithPrimeObservation:25,distinctPrimeCount:400},
    {level:'county',jurisdictionCount:3200,jurisdictionsWithVerifiedAwardSource:100,jurisdictionsWithActiveAwardAdapter:20,jurisdictionsWithAwardObservation:10,jurisdictionsWithPrimeObservation:8,distinctPrimeCount:50},
    {level:'city',jurisdictionCount:19000,jurisdictionsWithVerifiedAwardSource:200,jurisdictionsWithActiveAwardAdapter:50,jurisdictionsWithAwardObservation:20,jurisdictionsWithPrimeObservation:15,distinctPrimeCount:80},
    {level:'school_district',jurisdictionCount:13000,jurisdictionsWithVerifiedAwardSource:150,jurisdictionsWithActiveAwardAdapter:40,jurisdictionsWithAwardObservation:15,jurisdictionsWithPrimeObservation:12,distinctPrimeCount:60},
  ],
  totalJurisdictions:35251,
  totalWithVerifiedAwardSource:501,
  totalWithActiveAwardAdapter:161,
  totalWithAwardObservation:75,
  totalWithPrimeObservation:60,
  totalDistinctPrimes:590,
  unhydratedLevels:['special_district','authority','public_university','public_hospital'],
}
const assessment=assessPublicPrimeCoverage(partial)
assert.equal(assessment.status,'PARTIAL')
assert.deepEqual(assessment.missingJurisdictionLevels,['special_district','authority','public_university','public_hospital'])
assert.ok(assessment.sourceCoveragePct>0)
assert.equal(assessment.externalContactAuthorized,false)

const fullLevels=PUBLIC_PRIME_REQUIRED_LEVELS.map(level=>({
  level,
  jurisdictionCount:10,
  jurisdictionsWithVerifiedAwardSource:10,
  jurisdictionsWithActiveAwardAdapter:10,
  jurisdictionsWithAwardObservation:4,
  jurisdictionsWithPrimeObservation:3,
  distinctPrimeCount:5,
}))
const full=assessPublicPrimeCoverage({
  levels:fullLevels,
  totalJurisdictions:80,
  totalWithVerifiedAwardSource:80,
  totalWithActiveAwardAdapter:80,
  totalWithAwardObservation:32,
  totalWithPrimeObservation:24,
  totalDistinctPrimes:40,
  unhydratedLevels:[],
})
assert.equal(full.status,'FULL')
assert.equal(full.sourceCoveragePct,100)
assert.equal(full.activeAdapterCoveragePct,100)
assert.equal(full.primeObservationCoveragePct,30)

const empty=assessPublicPrimeCoverage({
  levels:[],
  totalJurisdictions:0,
  totalWithVerifiedAwardSource:0,
  totalWithActiveAwardAdapter:0,
  totalWithAwardObservation:0,
  totalWithPrimeObservation:0,
  totalDistinctPrimes:0,
  unhydratedLevels:[...PUBLIC_PRIME_REQUIRED_LEVELS],
})
assert.equal(empty.status,'BLOCKED')

console.log('public prime coverage tests passed')
