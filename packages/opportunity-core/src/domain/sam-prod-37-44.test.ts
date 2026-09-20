import assert from 'node:assert/strict'
import { extractSolicitationIntelligence } from './solicitation-intelligence.js'
import { buildContractorPerformanceProfile } from './contractor-performance.js'
import { buildProviderDossier } from './provider-dossier.js'
import { assembleProposal } from './proposal-assembly.js'
import { createAwardExecutionHandoff } from './award-execution-handoff.js'
import { evaluateSamProd44Acceptance } from './sam-prod-44-acceptance.js'
const intel=extractSolicitationIntelligence([{id:'d',opportunityId:'o',kind:'sow',version:'1',capturedAt:'x',sourceRef:'sam:attachment:1',text:'Contractor shall perform electrical work. Deliverable report due date Friday. FAR clause applies.'}]);assert.equal(intel.requirements.length,1);assert.equal(intel.bidSubmissionAuthorized,false)
const provider:any={id:'p',legalName:'Provider',identifiers:[],serviceAreas:[],capabilities:[],credentials:[],pastPerformance:[],capacity:{status:'available',evidenceRefs:['e']},evidence:[{id:'e'}],sourceIds:[],verificationStatus:'verified',stage:'verified',riskFlags:[],createdAt:'x',updatedAt:'x'}
assert.equal(buildProviderDossier(provider).engagementAuthorized,false)
const proposal=assembleProposal('pp','o',['compliance_matrix','technical','staffing','past_performance','schedule','pricing'].map((kind,i)=>({id:String(i),kind:kind as any,contentRef:'c',evidenceRefs:['e'],complete:true})));assert.equal(proposal.status,'submission_ready_for_human');assert.equal(proposal.bidSubmissionAuthorized,false)
const handoff=createAwardExecutionHandoff({opportunityId:'o',awardRef:'award:1',awardedAt:'x',evidenceRefs:['e']});assert.equal(handoff.paymentAuthorized,false)
const profile=buildContractorPerformanceProfile('p',[{id:'x',providerId:'p',opportunityId:'o',occurredAt:'x',kind:'delivery',score:.9,evidenceRefs:['delivery:1']}]);assert.equal(profile.deliveryScore,.9);assert.equal(profile.selectionAuthority,'INTELLIGENCE_ONLY')
const result=evaluateSamProd44Acceptance(['a','b','c'].map(id=>({id,solicitationEvidenceComplete:true,providerDossierBuilt:true,acquisitionGoverned:true,proposalEvidenceComplete:true,awardReceiptRecorded:true,executionHandoffRecovered:true,performanceProfile:profile,unauthorizedExternalActions:0})));assert.equal(result.status,'pass');assert.equal(result.automaticProviderSelectionAuthorized,false)
console.log('sam-prod-37-44 tests passed')
