import assert from 'node:assert/strict'
import {summarizeNationalProcurementCoverage,planNationwideDiscoveryRecovery,type NationalCoverageRow} from './national-procurement-coverage.js'
const report=summarizeNationalProcurementCoverage([
 {state_code:'CA',level:'school_district',jurisdictions:100,source_bearing:25,verified_source_jurisdictions:12,
  certified_read_only_jurisdictions:2,total_source_records:39,blocked_jobs:75,no_provider_jobs:66,recovery_ready_jobs:1},
 {state_code:'CA',level:'special_district',jurisdictions:200,source_bearing:0,verified_source_jurisdictions:0,
  certified_read_only_jurisdictions:0,total_source_records:0,blocked_jobs:200,no_provider_jobs:160,recovery_ready_jobs:0},
 {state_code:'NY',level:'city',jurisdictions:50,source_bearing:5,verified_source_jurisdictions:2,
  certified_read_only_jurisdictions:0,total_source_records:12,blocked_jobs:45,no_provider_jobs:45,recovery_ready_jobs:4},
] as NationalCoverageRow[])
assert.equal(report.stateCount,51)
assert.equal(report.states.length,51)
assert.equal(report.representedStates,2)
assert.equal(report.registryJurisdictions,350)
assert.equal(report.sourceBearingJurisdictions,30)
assert.equal(report.officiallyVerifiedJurisdictions,14)
assert.equal(report.certifiedReadOnlyJurisdictions,2)
assert.equal(report.blockedDiscoveryJobs,320)
assert.equal(report.noProviderJobs,271)
assert.equal(report.states.find(x=>x.state==='CA')?.jurisdictions,300)
assert.equal(report.states.find(x=>x.state==='DC')?.jurisdictions,0)
assert.equal(report.states.find(x=>x.state==='NY')?.totalSourceRecords,12)
assert.equal(report.coverageComplete,false)
assert.equal(report.externalContactAuthorized,false)
assert.equal(report.biddingAuthorized,false)
assert.equal(report.spendingAuthorized,false)
const make=(id:string,override:Record<string,unknown>={})=>({
 jobId:id,jurisdictionId:'city:1234',state:'CA' as const,level:'city' as const,
 status:'blocked' as const,lastError:'PUBLIC_SOURCE_NO_OFFICIAL_DOMAIN_AND_SEARCH_NOT_CONFIGURED',
 sourceReferences:[],officialDomains:['city.example.gov'],attemptCount:1,...override,
})
const plans=planNationwideDiscoveryRecovery([
 make('eligible'),
 make('no_domain',{officialDomains:[]}),
 make('already_sourced',{sourceReferences:['ref:1']}),
 make('exhausted',{lastError:'SOURCE_DISCOVERY_RETRY_EXHAUSTED:fetch failed'}),
 make('active',{status:'adapter_required'}),
])
assert.deepEqual(plans.map(x=>x.action),['requeue_official_only','manual_review','manual_review','manual_review','preserve_existing'])
assert.ok(plans.every(x=>!x.searchQueryAuthorized&&!x.externalContactAuthorized))
assert.throws(()=>planNationwideDiscoveryRecovery([make('same'),make('same')]),/Duplicate/)
assert.throws(()=>planNationwideDiscoveryRecovery([],21),/bounded/)
console.log('PROCURE.NATIONAL nationwide state coverage, unresolved kinds and exact-id recovery guards PASS')
