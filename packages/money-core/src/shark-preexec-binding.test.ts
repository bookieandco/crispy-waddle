import { describe,it } from 'node:test'
import assert from 'node:assert/strict'
import {
 createSharkPreExecutionBinding,
 assertSharkPreExecutionBinding,
 type SharkPreExecutionMaterial,
} from './shark-preexec-binding.js'
import type { EdgeDecisionBundleReceipt,Edge007IntegrityReceipt } from './dex-four-stage-certification.js'

const at='2026-09-27T19:00:00.000Z'
const edgeDecisionBundle=():EdgeDecisionBundleReceipt=>Object.freeze({
 frameworkVersion:'EDGE-001-006-v1',
 receipts:Object.freeze((['EDGE-001','EDGE-002','EDGE-003','EDGE-004','EDGE-005','EDGE-006'] as const).map(gateId=>Object.freeze({
  gateId,version:'EDGE-001-006-v1',disposition:'PASS' as const,reasonCodes:Object.freeze([]),evidenceIds:Object.freeze(['e:'+gateId]),evaluatedAt:at,authority:'RESEARCH_AND_RISK_GATE_ONLY' as const,canAuthorizeTrade:false as const,
 }))),
 disposition:'PASS',reasonCodes:Object.freeze([]),evidenceIds:Object.freeze(['edge-bundle']),authority:'RESEARCH_AND_RISK_GATE_ONLY',canAuthorizeTrade:false,
})
const integrity=():Edge007IntegrityReceipt=>Object.freeze({
 guardVersion:'EDGE-007-v1',guardId:'edge007:1',disposition:'PASS',reasonCodes:Object.freeze([]),evidenceIds:Object.freeze(['edge007']),authority:'INTEGRITY_VETO_ONLY',canAuthorizeTrade:false,canAuthorizePromotion:false,
})
const material=():SharkPreExecutionMaterial=>Object.freeze({
 assessmentId:'assessment-1',
 assessment:Object.freeze({assessmentId:'assessment-1',token:{chainId:'solana',tokenAddress:'TOKEN'},confidence:.72,riskAssessment:{band:'candidate'}}),
 assessmentEvidenceIds:Object.freeze(['assessment:evidence']),
 edgeDecisionBundle:edgeDecisionBundle(),
 integrityGuard:integrity(),
})

describe('SHARK-PREEXEC.FINAL',()=>{
 it('binds assessment plus EDGE-001 through EDGE-007 hashes into an immutable receipt',()=>{
  const m=material()
  const binding=createSharkPreExecutionBinding({material:m,informationCutoff:at,evidenceIds:['money:intent']})
  assert.equal(binding.assessmentId,'assessment-1')
  assert.equal(binding.authority,'PREEXEC_BINDING_ONLY')
  assert.equal(binding.canAuthorizeTrade,false)
  assert.equal(Object.keys(binding.edgeHashes).length,7)
  assert.ok(binding.edgeHashes['EDGE-001'])
  assert.ok(binding.edgeHashes['EDGE-007'])
  assert.ok(binding.bindingHash)
  assert.doesNotThrow(()=>assertSharkPreExecutionBinding({binding,material:m,informationCutoff:at}))
 })
 it('fails closed when the SHARK assessment changes after Money bound the intent',()=>{
  const m=material()
  const binding=createSharkPreExecutionBinding({material:m,informationCutoff:at})
  const mutated:SharkPreExecutionMaterial={...m,assessment:{...(m.assessment as Record<string,unknown>),confidence:.99}}
  assert.throws(()=>assertSharkPreExecutionBinding({binding,material:mutated,informationCutoff:at}),/SHARK_PREEXEC_ASSESSMENT_HASH_MISMATCH/)
 })
 it('fails closed when any EDGE receipt is blocked or missing',()=>{
  const m=material()
  const receipts=m.edgeDecisionBundle.receipts.map((x,i)=>i===2?{...x,disposition:'BLOCK' as const,reasonCodes:['blocked']}:x)
  const blocked:SharkPreExecutionMaterial={...m,edgeDecisionBundle:{...m.edgeDecisionBundle,receipts}}
  assert.throws(()=>createSharkPreExecutionBinding({material:blocked,informationCutoff:at}),/SHARK_PREEXEC_EDGE_BLOCKED:EDGE-003/)
  const missing:SharkPreExecutionMaterial={...m,edgeDecisionBundle:{...m.edgeDecisionBundle,receipts:m.edgeDecisionBundle.receipts.slice(0,5)}}
  assert.throws(()=>createSharkPreExecutionBinding({material:missing,informationCutoff:at}),/SHARK_PREEXEC_EDGE_RECEIPT_SET_INVALID/)
 })
 it('fails closed when the binding itself is tampered',()=>{
  const m=material()
  const binding=createSharkPreExecutionBinding({material:m,informationCutoff:at})
  const tampered={...binding,bindingHash:'0'.repeat(64)}
  assert.throws(()=>assertSharkPreExecutionBinding({binding:tampered,material:m,informationCutoff:at}),/SHARK_PREEXEC_BINDING_HASH_MISMATCH/)
 })
})
