import assert from 'node:assert/strict'
import { buildSamDateWindows, classifySamNoticeChange, normalizeSamWideNotice } from './sam-wide.js'
import { evaluateSamSubcontractability } from './sam-subcontractability.js'
import { buildBrokerShortlist } from './sam-provider-broker.js'
import { certifySamUsableFinal } from './sam-usable-final.js'
import { computeSamMarketCoverage, nextSamBootstrapWindow } from './sam-market-coverage.js'

const raw={noticeId:'N1',title:'Food delivery',naicsCode:'424410',resourceLinks:['https://example.test/a.pdf']}
const n=normalizeSamWideNotice(raw,'2026-09-21T00:00:00.000Z')
assert.equal(n.noticeId,'N1');assert.equal(n.resourceLinks.length,1)
assert.equal(classifySamNoticeChange(undefined,n.checksum),'new')
assert.equal(classifySamNoticeChange(n.checksum,n.checksum),'unchanged')
assert.equal(buildSamDateWindows({from:'2026-09-01',to:'2026-09-10',windowDays:7}).length,2)

const blocked=evaluateSamSubcontractability({agencyKind:'dod',contractKind:'supply',isFood:true,clauses:['DFARS 252.225-7012'],providerCountry:'MX',productCountry:'MX'})
assert.equal(blocked.status,'blocked')
const logistics=evaluateSamSubcontractability({agencyKind:'dod',contractKind:'supply',isFood:true,clauses:['DFARS 252.225-7012'],providerCountry:'MX',productCountry:'US'})
assert.notEqual(logistics.status,'blocked')

const shortlist=buildBrokerShortlist([{id:'r1',label:'bulk food distribution',naicsCodes:['424410']}],[{id:'p1',legalName:'Food Co',country:'MX',naicsCodes:['424410'],keywords:['bulk food distribution'],awardCount:2,evidence:[{id:'e1',source:'sam_entity'},{id:'e2',source:'usaspending'}]}])
assert.equal(shortlist[0].candidates[0].status,'candidate')

const coverage=computeSamMarketCoverage({intervals:[{postedFrom:'09/01/2025',postedTo:'03/31/2026'},{postedFrom:'04/01/2026',postedTo:'09/21/2026'}],targetFrom:'2025-09-22',targetTo:'2026-09-21'})
assert.equal(coverage.complete,true)
assert.equal(nextSamBootstrapWindow({intervals:[{postedFrom:'09/15/2026',postedTo:'09/21/2026'}],today:'2026-09-21',historyDays:365,windowDays:7})?.to,'2026-09-14')

assert.equal(certifySamUsableFinal({runtimeBound:true,scanReceipts:1,marketCoverageComplete:true,marketCoverageDays:365,realNotices:3,noticesWithDocuments:3,noticesWithSubcontractability:3,noticesWithProviderCandidates:3,realProviderCandidates:3,provenanceComplete:true,unauthorizedExternalActions:0,silentFallbacks:0}).status,'pass')
console.log('sam usable final domain tests passed')
