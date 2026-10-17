import assert from 'node:assert/strict'
import { buildSamDateWindows, classifySamNoticeChange, normalizeSamWideNotice } from './sam-wide.js'
import { evaluateSamSubcontractability, isUsCountry, normalizeCountryCode } from './sam-subcontractability.js'
import { buildBrokerShortlist } from './sam-provider-broker.js'
import { certifySamUsableFinal, evaluateSamCertRows, type SamUsableEvidence, type SamCertRows } from './sam-usable-final.js'
import { computeSamMarketCoverage, nextSamBootstrapWindow } from './sam-market-coverage.js'

const raw={noticeId:'N1',title:'Food delivery',naicsCode:'424410',resourceLinks:['https://example.test/a.pdf']}
const n=normalizeSamWideNotice(raw,'2026-09-21T00:00:00.000Z')
assert.equal(n.noticeId,'N1');assert.equal(n.resourceLinks.length,1)
assert.equal(classifySamNoticeChange(undefined,n.checksum),'new')
assert.equal(classifySamNoticeChange(n.checksum,n.checksum),'unchanged')
assert.equal(buildSamDateWindows({from:'2026-09-01',to:'2026-09-10',windowDays:7}).length,2)

assert.equal(isUsCountry('USA'),true)
assert.equal(isUsCountry('United States of America'),true)
assert.equal(normalizeCountryCode('Mexico'),'MX')

const blocked=evaluateSamSubcontractability({agencyKind:'dod',contractKind:'supply',isFood:true,clauses:['DFARS 252.225-7012'],providerCountry:'MX',productCountry:'MX'})
assert.equal(blocked.status,'blocked')
const logistics=evaluateSamSubcontractability({agencyKind:'dod',contractKind:'supply',isFood:true,clauses:['DFARS 252.225-7012'],providerCountry:'MX',productCountry:'US'})
assert.notEqual(logistics.status,'blocked')

const shortlist=buildBrokerShortlist([{id:'r1',label:'bulk food distribution',naicsCodes:['424410']}],[{id:'p1',legalName:'Food Co',country:'MX',naicsCodes:['424410'],keywords:['bulk food distribution'],awardCount:2,evidence:[{id:'e1',source:'sam_entity'},{id:'e2',source:'usaspending'}]}])
assert.equal(shortlist[0].candidates[0].status,'candidate')

const coverage=computeSamMarketCoverage({intervals:[{postedFrom:'09/01/2025',postedTo:'03/31/2026'},{postedFrom:'04/01/2026',postedTo:'09/21/2026'}],targetFrom:'2025-09-22',targetTo:'2026-09-21'})
assert.equal(coverage.complete,true)
assert.equal(nextSamBootstrapWindow({intervals:[{postedFrom:'09/15/2026',postedTo:'09/21/2026'}],today:'2026-09-21',historyDays:365,windowDays:7})?.to,'2026-09-14')

// SAM-CERT-HARDEN.01–.04: three correlated, evidence-backed cases.
const caseRows=(ids:string[]):SamCertRows=>({
  catalog:ids.map(id=>({notice_id:id,source_url:`https://sam.gov/opp/${id}`,checksum:`digest:${id}`})),
  documents:ids.map((id,index)=>({id:index+1,notice_id:id,source_kind:'attachment',source_url:`https://sam.gov/attachment/${id}`,checksum:`doc:${id}`,fetch_status:'text_captured',extracted_text:'Required delivery scope'})),
  analysis:ids.map(id=>({notice_id:id,requirements:[{id:`req:${id}`}],subcontractability:{status:'pass'}})),
  providers:ids.map((id,index)=>({id:index+1,notice_id:id,requirement_id:`req:${id}`,provider_key:`provider:${id}`,status:'candidate',sources:['sam_entity','usaspending'],evidence:[{id:`entity:${id}`,source:'sam_entity'},{id:`award:${id}`,source:'usaspending'}]})),
  pursuits:ids.map(id=>({notice_id:id,status:'ready_for_quote',assignments:[{providerKey:`provider:${id}`,requirementIds:[`req:${id}`],reviewRequired:false}],uncovered_requirement_ids:[],blockers:[],commercial:{status:'quote_required',contractValue:5000,blockers:['Real quote is still required']}})),
})
const rows3=caseRows(['N1','N2','N3'])
const metrics=evaluateSamCertRows(rows3)
assert.equal(metrics.correlatedCompleteNotices,3)
assert.equal(metrics.noticesWithProviderCandidates,3)
assert.equal(metrics.provenanceComplete,true)
const accepted:SamUsableEvidence={
  runtimeBound:true,scanReceipts:1,marketCoverageComplete:true,marketCoverageDays:365,
  ...metrics,safetyEvidenceComplete:true,unauthorizedExternalActions:0,silentFallbacks:0,
}
assert.equal(certifySamUsableFinal(accepted).status,'pass')

// Missing authoritative safety receipts are not safe zeros.
assert.equal(certifySamUsableFinal({...accepted,safetyEvidenceComplete:false,unauthorizedExternalActions:null,silentFallbacks:null}).status,'fail')
assert.equal(certifySamUsableFinal({...accepted,unauthorizedExternalActions:1}).status,'fail')
assert.equal(certifySamUsableFinal({...accepted,silentFallbacks:1}).status,'fail')
assert.equal(certifySamUsableFinal({...accepted,scanReceipts:0}).status,'fail')
assert.equal(certifySamUsableFinal({...accepted,runtimeBound:false}).status,'fail')

// Independent 3+ populations MUST NOT substitute for three complete notices.
const disconnected:SamCertRows={
  catalog:caseRows(['A','B','C','D','E','F']).catalog,
  documents:caseRows(['A','B','C']).documents,
  analysis:caseRows(['D','E','F']).analysis,
  providers:caseRows(['A','B','C']).providers,
  pursuits:caseRows(['D','E','F']).pursuits,
}
assert.equal(evaluateSamCertRows(disconnected).correlatedCompleteNotices,0)
assert.equal(certifySamUsableFinal({...accepted,...evaluateSamCertRows(disconnected)}).status,'fail')

// Review-required / blocked providers and unsupported commercial states are not ready.
const reviewed:SamCertRows=structuredClone(rows3)
reviewed.providers[0]!.status='review_required'
assert.equal(evaluateSamCertRows(reviewed).correlatedCompleteNotices,2)
const invented:SamCertRows=structuredClone(rows3)
;(invented.pursuits[0]!.commercial as Record<string,unknown>).status='looks_good'
assert.equal(evaluateSamCertRows(invented).correlatedCompleteNotices,2)
const mismatched:SamCertRows=structuredClone(rows3)
;(mismatched.pursuits[0]!.assignments as Record<string,unknown>[])[0]!.providerKey='not-this-provider'
assert.equal(evaluateSamCertRows(mismatched).correlatedCompleteNotices,2)
const uncorroborated:SamCertRows=structuredClone(rows3)
uncorroborated.providers[0]!.sources=['sam_entity','usaspending']
uncorroborated.providers[0]!.evidence=[{id:'same-source-only',source:'sam_entity'}]
assert.equal(evaluateSamCertRows(uncorroborated).correlatedCompleteNotices,2)
const malformed:SamCertRows=structuredClone(rows3)
malformed.documents[0]!.checksum=null
assert.equal(evaluateSamCertRows(malformed).provenanceComplete,false)
assert.equal(evaluateSamCertRows(malformed).correlatedCompleteNotices,2)
const empty=caseRows([])
assert.equal(evaluateSamCertRows(empty).provenanceComplete,false)

console.log('sam usable final domain tests passed')
