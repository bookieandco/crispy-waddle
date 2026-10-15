import test from 'node:test'
import assert from 'node:assert/strict'
import {assessDeerFlowResearch,type DeerFlowResearchReceipt} from './biz-purse-deerflow-research.js'
const asOf='2026-10-14T23:00:00.000Z'
const sha='a'.repeat(40)
const base:DeerFlowResearchReceipt={
 runId:'research:1',ownerUserId:'owner:1',businessId:'client-capture',family:'business_automation',
 sourceRepository:'bytedance/deer-flow',upstreamCommitSha:sha,status:'COMPLETED',
 taskCategory:'BUSINESS_RESEARCH',hostedModelRequestCount:0,hostMode:'ISOLATED_LOCAL',
 observedAt:asOf,responseEvidenceIds:['source:1','source:2'],
 externalEvidence:[
  {id:'source:1',sourceUrl:'https://example.org/1',observedAt:asOf,independentlyObserved:true,synthetic:false},
  {id:'source:2',sourceUrl:'https://second.org/2',observedAt:asOf,independentlyObserved:true,synthetic:false},
 ],
 independentlyVerifiedEvidenceIds:['source:1','source:2'],
 verifier:'JHADINA_PROVENANCE_VERIFIER',sandboxAttested:true,
 gatewayAdminAuthority:false,shellExecutionAuthority:false,fileWriteAuthority:false,
 paymentAuthority:false,tradingAuthority:false,liveExternalActionAuthority:false,
 financialCredentialsExposed:false,bearerTokensExposed:false,synthetic:false,
}
const evaluate=(receipt:DeerFlowResearchReceipt)=>assessDeerFlowResearch({receipt,ownerUserId:'owner:1',approvedBusinessId:'client-capture',approvedFamily:'business_automation',asOf,approvedUpstreamCommitSha:sha,availableCostBudgetMinor:0n})
test('verifiable pinned read-only research can only be imported for review',()=>{
 const r=evaluate(base);assert.equal(r.status,'REVIEW_READY')
 assert.equal(r.mayStartGateway,false);assert.equal(r.mayExecuteTools,false);assert.equal(r.mayMoveMoney,false)
})
test('privileged gateway/admin/shell or exposed credentials is blocked',()=>{
 const r=evaluate({...base,gatewayAdminAuthority:true as false,shellExecutionAuthority:true as false,financialCredentialsExposed:true as false})
 assert.equal(r.status,'BLOCKED');assert(r.reasonCodes.includes('PRIVILEGED_CAPABILITY_OR_SECRET_EXPOSURE'))
})
test('untrusted provenance, incomplete agent output and mismatched owner are blocked',()=>{
 const r=evaluate({...base,status:'INCOMPLETE',ownerUserId:'wrong',verifier:'UNVERIFIED'})
 assert.equal(r.status,'BLOCKED');assert(r.reasonCodes.includes('RESEARCH_NOT_COMPLETE'))
 assert(r.reasonCodes.includes('SELF_ATTESTED_OR_SYNTHETIC_RESEARCH'))
})
test('un-pinned upstream version, synthetic data and non-independent evidence cannot pass',()=>{
 const r=evaluate({...base,upstreamCommitSha:'b'.repeat(40),synthetic:true,independentlyVerifiedEvidenceIds:[]})
 assert.equal(r.status,'BLOCKED');assert(r.reasonCodes.includes('UPSTREAM_COMMIT_UNPINNED'))
 assert(r.reasonCodes.includes('EVIDENCE_NOT_INDEPENDENTLY_MATCHED'))
})
