import { createHash } from 'node:crypto'
import {
 EDGE_007_REQUIRED_VERSION,
 EDGE_DECISION_REQUIRED_VERSION,
 type Edge007IntegrityReceipt,
 type EdgeDecisionBundleReceipt,
 type EdgeDecisionGateReceipt,
} from './dex-four-stage-certification.js'

export const SHARK_PREEXEC_BINDING_VERSION='SHARK-PREEXEC-v1' as const
export type SharkEdgeGateId='EDGE-001'|'EDGE-002'|'EDGE-003'|'EDGE-004'|'EDGE-005'|'EDGE-006'|'EDGE-007'

export type SharkPreExecutionMaterial=Readonly<{
 assessmentId:string
 assessment:unknown
 assessmentEvidenceIds:readonly string[]
 edgeDecisionBundle:EdgeDecisionBundleReceipt
 integrityGuard:Edge007IntegrityReceipt
}>

export type SharkPreExecutionBinding=Readonly<{
 version:typeof SHARK_PREEXEC_BINDING_VERSION
 assessmentId:string
 assessmentHash:string
 edgeHashes:Readonly<Record<SharkEdgeGateId,string>>
 edgeDecisionBundleHash:string
 informationCutoff:string
 evidenceIds:readonly string[]
 bindingHash:string
 authority:'PREEXEC_BINDING_ONLY'
 canAuthorizeTrade:false
}>

function canonical(value:unknown):unknown{
 if(value===null||typeof value==='string'||typeof value==='boolean')return value
 if(typeof value==='number'){
  if(!Number.isFinite(value))throw new Error('SHARK_PREEXEC_NONFINITE_NUMBER')
  return value
 }
 if(typeof value==='bigint')return {__bigint:value.toString()}
 if(Array.isArray(value))return value.map(canonical)
 if(typeof value==='object'){
  const out:Record<string,unknown>={}
  for(const key of Object.keys(value as Record<string,unknown>).sort()){
   const child=(value as Record<string,unknown>)[key]
   if(child===undefined)continue
   out[key]=canonical(child)
  }
  return out
 }
 throw new Error('SHARK_PREEXEC_UNHASHABLE_VALUE')
}

export function hashSharkPreExecution(value:unknown):string{
 return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

function iso(value:string,code:string):void{
 if(!value.trim()||Number.isNaN(Date.parse(value)))throw new Error(code)
}
function nonEmpty(value:string,code:string):void{
 if(!value.trim())throw new Error(code)
}

function assertDecisionGate(receipt:EdgeDecisionGateReceipt):void{
 if(receipt.version!==EDGE_DECISION_REQUIRED_VERSION)throw new Error('SHARK_PREEXEC_EDGE_VERSION_INVALID:'+receipt.gateId)
 if(receipt.authority!=='RESEARCH_AND_RISK_GATE_ONLY'||receipt.canAuthorizeTrade!==false)throw new Error('SHARK_PREEXEC_EDGE_AUTHORITY_INVALID:'+receipt.gateId)
 if(receipt.disposition!=='PASS'||receipt.reasonCodes.length)throw new Error('SHARK_PREEXEC_EDGE_BLOCKED:'+receipt.gateId)
 if(!receipt.evidenceIds.length)throw new Error('SHARK_PREEXEC_EDGE_EVIDENCE_REQUIRED:'+receipt.gateId)
 iso(receipt.evaluatedAt,'SHARK_PREEXEC_EDGE_TIME_INVALID:'+receipt.gateId)
}

function orderedDecisionReceipts(bundle:EdgeDecisionBundleReceipt):readonly EdgeDecisionGateReceipt[]{
 if(bundle.frameworkVersion!==EDGE_DECISION_REQUIRED_VERSION)throw new Error('SHARK_PREEXEC_EDGE_BUNDLE_VERSION_INVALID')
 if(bundle.authority!=='RESEARCH_AND_RISK_GATE_ONLY'||bundle.canAuthorizeTrade!==false)throw new Error('SHARK_PREEXEC_EDGE_BUNDLE_AUTHORITY_INVALID')
 if(bundle.disposition!=='PASS'||bundle.reasonCodes.length)throw new Error('SHARK_PREEXEC_EDGE_BUNDLE_BLOCKED')
 if(!bundle.evidenceIds.length)throw new Error('SHARK_PREEXEC_EDGE_BUNDLE_EVIDENCE_REQUIRED')
 const required=['EDGE-001','EDGE-002','EDGE-003','EDGE-004','EDGE-005','EDGE-006'] as const
 const byId=new Map(bundle.receipts.map(receipt=>[receipt.gateId,receipt]))
 if(byId.size!==required.length||bundle.receipts.length!==required.length)throw new Error('SHARK_PREEXEC_EDGE_RECEIPT_SET_INVALID')
 return Object.freeze(required.map(gateId=>{
  const receipt=byId.get(gateId)
  if(!receipt)throw new Error('SHARK_PREEXEC_EDGE_RECEIPT_REQUIRED:'+gateId)
  assertDecisionGate(receipt)
  return receipt
 }))
}

function assertIntegrity(receipt:Edge007IntegrityReceipt):void{
 if(receipt.guardVersion!==EDGE_007_REQUIRED_VERSION)throw new Error('SHARK_PREEXEC_EDGE007_VERSION_INVALID')
 nonEmpty(receipt.guardId,'SHARK_PREEXEC_EDGE007_ID_REQUIRED')
 if(receipt.authority!=='INTEGRITY_VETO_ONLY'||receipt.canAuthorizeTrade!==false||receipt.canAuthorizePromotion!==false)throw new Error('SHARK_PREEXEC_EDGE007_AUTHORITY_INVALID')
 if(receipt.disposition!=='PASS'||receipt.reasonCodes.length)throw new Error('SHARK_PREEXEC_EDGE007_BLOCKED')
 if(!receipt.evidenceIds.length)throw new Error('SHARK_PREEXEC_EDGE007_EVIDENCE_REQUIRED')
}

function coreBinding(input:{
 material:SharkPreExecutionMaterial
 informationCutoff:string
 evidenceIds:readonly string[]
}):Omit<SharkPreExecutionBinding,'bindingHash'>{
 const {material}=input
 nonEmpty(material.assessmentId,'SHARK_PREEXEC_ASSESSMENT_ID_REQUIRED')
 if(material.assessment===null||material.assessment===undefined)throw new Error('SHARK_PREEXEC_ASSESSMENT_REQUIRED')
 if(!material.assessmentEvidenceIds.length)throw new Error('SHARK_PREEXEC_ASSESSMENT_EVIDENCE_REQUIRED')
 iso(input.informationCutoff,'SHARK_PREEXEC_CUTOFF_INVALID')
 const receipts=orderedDecisionReceipts(material.edgeDecisionBundle)
 assertIntegrity(material.integrityGuard)
 const assessmentHash=hashSharkPreExecution(material.assessment)
 const edgeHashes={} as Record<SharkEdgeGateId,string>
 for(const receipt of receipts)edgeHashes[receipt.gateId]=hashSharkPreExecution(receipt)
 edgeHashes['EDGE-007']=hashSharkPreExecution(material.integrityGuard)
 const edgeDecisionBundleHash=hashSharkPreExecution({
  frameworkVersion:material.edgeDecisionBundle.frameworkVersion,
  disposition:material.edgeDecisionBundle.disposition,
  reasonCodes:material.edgeDecisionBundle.reasonCodes,
  evidenceIds:material.edgeDecisionBundle.evidenceIds,
  receiptHashes:receipts.map(receipt=>[receipt.gateId,edgeHashes[receipt.gateId]]),
 })
 const evidenceIds=Object.freeze([...new Set([
  ...input.evidenceIds,
  ...material.assessmentEvidenceIds,
  ...material.edgeDecisionBundle.evidenceIds,
  ...receipts.flatMap(receipt=>receipt.evidenceIds),
  ...material.integrityGuard.evidenceIds,
 ])].sort())
 if(!evidenceIds.length)throw new Error('SHARK_PREEXEC_EVIDENCE_REQUIRED')
 return Object.freeze({
  version:SHARK_PREEXEC_BINDING_VERSION,
  assessmentId:material.assessmentId,
  assessmentHash,
  edgeHashes:Object.freeze({...edgeHashes}),
  edgeDecisionBundleHash,
  informationCutoff:input.informationCutoff,
  evidenceIds,
  authority:'PREEXEC_BINDING_ONLY' as const,
  canAuthorizeTrade:false as const,
 })
}

export function createSharkPreExecutionBinding(input:{
 material:SharkPreExecutionMaterial
 informationCutoff:string
 evidenceIds?:readonly string[]
}):SharkPreExecutionBinding{
 const core=coreBinding({material:input.material,informationCutoff:input.informationCutoff,evidenceIds:input.evidenceIds??[]})
 return Object.freeze({...core,bindingHash:hashSharkPreExecution(core)})
}

function sameStrings(a:readonly string[],b:readonly string[]):boolean{
 return JSON.stringify([...new Set(a)].sort())===JSON.stringify([...new Set(b)].sort())
}

export function assertSharkPreExecutionBinding(input:{
 binding:SharkPreExecutionBinding
 material:SharkPreExecutionMaterial
 informationCutoff:string
}):void{
 const {binding}=input
 if(binding.version!==SHARK_PREEXEC_BINDING_VERSION||binding.authority!=='PREEXEC_BINDING_ONLY'||binding.canAuthorizeTrade!==false)throw new Error('SHARK_PREEXEC_BINDING_AUTHORITY_INVALID')
 if(binding.informationCutoff!==input.informationCutoff)throw new Error('SHARK_PREEXEC_CUTOFF_BINDING_MISMATCH')
 const expected=createSharkPreExecutionBinding({material:input.material,informationCutoff:input.informationCutoff,evidenceIds:binding.evidenceIds})
 if(binding.assessmentId!==expected.assessmentId)throw new Error('SHARK_PREEXEC_ASSESSMENT_ID_MISMATCH')
 if(binding.assessmentHash!==expected.assessmentHash)throw new Error('SHARK_PREEXEC_ASSESSMENT_HASH_MISMATCH')
 for(const gateId of ['EDGE-001','EDGE-002','EDGE-003','EDGE-004','EDGE-005','EDGE-006','EDGE-007'] as const){
  if(binding.edgeHashes[gateId]!==expected.edgeHashes[gateId])throw new Error('SHARK_PREEXEC_EDGE_HASH_MISMATCH:'+gateId)
 }
 if(binding.edgeDecisionBundleHash!==expected.edgeDecisionBundleHash)throw new Error('SHARK_PREEXEC_EDGE_BUNDLE_HASH_MISMATCH')
 if(!sameStrings(binding.evidenceIds,expected.evidenceIds))throw new Error('SHARK_PREEXEC_EVIDENCE_MISMATCH')
 if(binding.bindingHash!==hashSharkPreExecution({
  version:binding.version,
  assessmentId:binding.assessmentId,
  assessmentHash:binding.assessmentHash,
  edgeHashes:binding.edgeHashes,
  edgeDecisionBundleHash:binding.edgeDecisionBundleHash,
  informationCutoff:binding.informationCutoff,
  evidenceIds:binding.evidenceIds,
  authority:binding.authority,
  canAuthorizeTrade:binding.canAuthorizeTrade,
 }))throw new Error('SHARK_PREEXEC_BINDING_HASH_MISMATCH')
}
