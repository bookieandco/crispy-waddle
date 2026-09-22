import { createHash } from 'node:crypto'

export const FX_VISION_SCHEMA_VERSION='MONEY-FOREX-VISION-01' as const
export type FxVisionDatasetId='roboflow:forex-sells/forex-buys'|'roboflow:forex-sells/forex-sells'
export type FxVisionSemanticStatus='OPAQUE_LABELS'
export type FxVisionDirection='BULLISH'|'BEARISH'|'UNRESOLVED'

export type FxVisionDatasetDescriptor=Readonly<{
  datasetId:FxVisionDatasetId
  sourceUrl:string
  title:string
  author:string
  task:'CLASSIFICATION'
  imageCount:number
  semanticStatus:FxVisionSemanticStatus
  rawClassPreview:readonly string[]
  licenseStatus:'UNVERIFIED'
  authority:'REFERENCE_ONLY'
  canAuthorizeLive:false
}>

export const FX_VISION_DATASETS:Readonly<Record<FxVisionDatasetId,FxVisionDatasetDescriptor>>=Object.freeze({
  'roboflow:forex-sells/forex-buys':Object.freeze({
    datasetId:'roboflow:forex-sells/forex-buys',sourceUrl:'https://universe.roboflow.com/forex-sells/forex-buys',title:'FOREX BUYS',author:'Forex Sells',task:'CLASSIFICATION',imageCount:126,semanticStatus:'OPAQUE_LABELS',rawClassPreview:Object.freeze(['0','1','2','4','5','6','8','9']),licenseStatus:'UNVERIFIED',authority:'REFERENCE_ONLY',canAuthorizeLive:false,
  }),
  'roboflow:forex-sells/forex-sells':Object.freeze({
    datasetId:'roboflow:forex-sells/forex-sells',sourceUrl:'https://universe.roboflow.com/forex-sells/forex-sells',title:'FOREX SELLS',author:'Forex Sells',task:'CLASSIFICATION',imageCount:199,semanticStatus:'OPAQUE_LABELS',rawClassPreview:Object.freeze(['1','10','2','4','5','6','8','9']),licenseStatus:'UNVERIFIED',authority:'REFERENCE_ONLY',canAuthorizeLive:false,
  }),
})

export type FxVisionRawInference=Readonly<{
  inferenceId:string
  datasetId:FxVisionDatasetId
  modelId:string
  modelVersion:string
  rawLabel:string
  confidenceBps:number
  instrumentId:string
  timeframe:string
  chartWindowStart:string
  chartWindowEnd:string
  imageEvidenceRef:string
  imageHash:string
  inferredAt:string
  availableAt:string
  evidenceRefs:readonly string[]
  provenanceHash:string
}>

export type FxVisionEvidence=Readonly<FxVisionRawInference&{
  schemaVersion:typeof FX_VISION_SCHEMA_VERSION
  direction:'UNRESOLVED'
  authority:'RESEARCH_ONLY'
  financialAuthority:'NONE'
  canAuthorizeLive:false
}>

export type FxVisionSemanticMapping=Readonly<{
  mappingId:string
  datasetId:FxVisionDatasetId
  rawLabel:string
  direction:Exclude<FxVisionDirection,'UNRESOLVED'>
  sampleSize:number
  precision:number
  recall:number
  evaluatedAt:string
  evidenceRefs:readonly string[]
  verifiedBy:string
  authority:'CALIBRATION_ONLY'
  canAuthorizeLive:false
}>

export type FxVisionResolvedEvidence=Readonly<Omit<FxVisionEvidence,'direction'>&{
  direction:Exclude<FxVisionDirection,'UNRESOLVED'>
  mappingId:string
  authority:'RESEARCH_ONLY'
  canAuthorizeLive:false
}>

const nonEmpty=(s:string,c:string)=>{if(!s.trim())throw new Error(c)}
const iso=(s:string,c:string)=>{if(Number.isNaN(Date.parse(s)))throw new Error(c)}
const unit=(n:number,c:string)=>{if(!Number.isFinite(n)||n<0||n>1)throw new Error(c)}
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')

export function createFxVisionEvidence(input:FxVisionRawInference):FxVisionEvidence{
  for(const [v,c] of [[input.inferenceId,'MONEY_FX_VISION_ID_REQUIRED'],[input.modelId,'MONEY_FX_VISION_MODEL_REQUIRED'],[input.modelVersion,'MONEY_FX_VISION_MODEL_VERSION_REQUIRED'],[input.rawLabel,'MONEY_FX_VISION_LABEL_REQUIRED'],[input.instrumentId,'MONEY_FX_VISION_INSTRUMENT_REQUIRED'],[input.timeframe,'MONEY_FX_VISION_TIMEFRAME_REQUIRED'],[input.imageEvidenceRef,'MONEY_FX_VISION_IMAGE_EVIDENCE_REQUIRED'],[input.imageHash,'MONEY_FX_VISION_IMAGE_HASH_REQUIRED'],[input.provenanceHash,'MONEY_FX_VISION_PROVENANCE_REQUIRED']] as const)nonEmpty(v,c)
  if(!Number.isInteger(input.confidenceBps)||input.confidenceBps<0||input.confidenceBps>10000)throw new Error('MONEY_FX_VISION_CONFIDENCE_INVALID')
  if(!input.evidenceRefs.length)throw new Error('MONEY_FX_VISION_EVIDENCE_REQUIRED')
  iso(input.chartWindowStart,'MONEY_FX_VISION_WINDOW_START_INVALID');iso(input.chartWindowEnd,'MONEY_FX_VISION_WINDOW_END_INVALID');iso(input.inferredAt,'MONEY_FX_VISION_INFERRED_AT_INVALID');iso(input.availableAt,'MONEY_FX_VISION_AVAILABLE_AT_INVALID')
  if(input.chartWindowEnd<=input.chartWindowStart)throw new Error('MONEY_FX_VISION_WINDOW_INVALID')
  if(input.inferredAt<input.chartWindowEnd)throw new Error('MONEY_FX_VISION_FUTURE_WINDOW_LEAK')
  if(input.availableAt<input.inferredAt)throw new Error('MONEY_FX_VISION_AVAILABILITY_INVALID')
  return Object.freeze({...input,schemaVersion:FX_VISION_SCHEMA_VERSION,evidenceRefs:Object.freeze([...new Set(input.evidenceRefs)].sort()),direction:'UNRESOLVED',authority:'RESEARCH_ONLY',financialAuthority:'NONE',canAuthorizeLive:false})
}

export function createFxVisionSemanticMapping(input:Omit<FxVisionSemanticMapping,'mappingId'|'authority'|'canAuthorizeLive'>):FxVisionSemanticMapping{
  nonEmpty(input.rawLabel,'MONEY_FX_VISION_MAPPING_LABEL_REQUIRED');nonEmpty(input.verifiedBy,'MONEY_FX_VISION_MAPPING_VERIFIER_REQUIRED')
  if(!Number.isInteger(input.sampleSize)||input.sampleSize<100)throw new Error('MONEY_FX_VISION_MAPPING_SAMPLE_TOO_SMALL')
  unit(input.precision,'MONEY_FX_VISION_MAPPING_PRECISION_INVALID');unit(input.recall,'MONEY_FX_VISION_MAPPING_RECALL_INVALID')
  if(input.precision<0.55||input.recall<0.55)throw new Error('MONEY_FX_VISION_MAPPING_QUALITY_TOO_LOW')
  iso(input.evaluatedAt,'MONEY_FX_VISION_MAPPING_TIME_INVALID')
  if(!input.evidenceRefs.length)throw new Error('MONEY_FX_VISION_MAPPING_EVIDENCE_REQUIRED')
  return Object.freeze({...input,mappingId:'fx-vision-map:'+hash({datasetId:input.datasetId,rawLabel:input.rawLabel,direction:input.direction,sampleSize:input.sampleSize,evaluatedAt:input.evaluatedAt,evidenceRefs:[...input.evidenceRefs].sort()}),evidenceRefs:Object.freeze([...new Set(input.evidenceRefs)].sort()),authority:'CALIBRATION_ONLY',canAuthorizeLive:false})
}

export function resolveFxVisionDirection(evidence:FxVisionEvidence,mapping:FxVisionSemanticMapping):FxVisionResolvedEvidence{
  if(evidence.datasetId!==mapping.datasetId||evidence.rawLabel!==mapping.rawLabel)throw new Error('MONEY_FX_VISION_MAPPING_MISMATCH')
  if(mapping.authority!=='CALIBRATION_ONLY'||mapping.canAuthorizeLive!==false)throw new Error('MONEY_FX_VISION_MAPPING_AUTHORITY_FORBIDDEN')
  return Object.freeze({...evidence,direction:mapping.direction,mappingId:mapping.mappingId,authority:'RESEARCH_ONLY',canAuthorizeLive:false})
}

export function assertFxVisionAvailableAtCutoff(evidence:FxVisionEvidence|FxVisionResolvedEvidence,cutoff:string):void{
  iso(cutoff,'MONEY_FX_VISION_CUTOFF_INVALID')
  if(evidence.availableAt>cutoff)throw new Error('MONEY_FX_VISION_FUTURE_LEAK')
}

export function assertFxVisionCannotAuthorizeLive(value:{authority:string;financialAuthority?:string;canAuthorizeLive:boolean}):void{
  if(value.canAuthorizeLive||value.authority==='EXECUTION'||(value.financialAuthority!==undefined&&value.financialAuthority!=='NONE'))throw new Error('MONEY_FX_VISION_AUTHORITY_FORBIDDEN')
}
