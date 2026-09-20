import assert from 'node:assert/strict'
import { buildConstructionFulfillmentModel } from './construction-fulfillment.js'
import { buildConstructionTenderModel } from './construction-tender.js'
import { evaluateContractorVerification } from './contractor-verification.js'
import { planSamDiscovery } from './sam-discovery-scheduler.js'
import { buildConstructionPursuitWorkspace } from './construction-pursuit-workspace.js'
import { evaluateSamProd36Acceptance } from './sam-prod-36-acceptance.js'
const set={opportunityId:'o',generatedAt:'x',unresolved:[],requirements:[{id:'r',opportunityId:'o',kind:'capability' as const,label:'Electrical renovation',severity:'required' as const,evidenceStatus:'explicit' as const,sourceClaimIds:['c'],sourceEvidenceIds:['e'],naicsCodes:['236220'],pscCodes:[],keywords:['electrical'],attributes:{},confidence:1,blockers:[]}]}
const model=buildConstructionFulfillmentModel(set);assert.deepEqual(model.trades,['electrical']);assert.equal(model.humanReviewRequired,true)
const tender=buildConstructionTenderModel(model,[]);assert.equal(tender.unpricedBoqItemIds.length,1);assert.equal(tender.bidSubmissionAuthorized,false)
const report=evaluateContractorVerification('p',[{dimension:'license',status:'unknown',claim:'license valid',evidenceRefs:[],confidence:0}]);assert.equal(report.status,'review_required');assert.equal(report.agentAuthority,'EVIDENCE_ONLY')
assert.equal(planSamDiscovery({id:'s',naicsCodes:['236220','236220','238210'],postedFrom:'09/20/2026',active:true},1).batches.length,1)
const ws=buildConstructionPursuitWorkspace(model,tender,[report]);assert.equal(ws.bidSubmissionAuthorized,false)
const acceptance=evaluateSamProd36Acceptance(['a','b','c'].map(id=>({id,workspace:ws,persistenceRecovered:true,unauthorizedExternalActions:0,sourceEvidenceComplete:true})));assert.equal(acceptance.status,'pass');assert.equal(acceptance.contractExecutionAuthorized,false)
console.log('sam-prod-30-36 tests passed')
