import { createHash } from 'node:crypto'

export const STOCK_VISION_SCHEMA_VERSION='MONEY-STOCK-VISION-01' as const

export type StockVisionDatasetId=
  |'roboflow:mod5gen20-cnkzt/stocks-2ulc2'
  |'roboflow:glitch-gyhbu/shitty-stocks-patterns'

export type StockChartPattern=
  |'TRIANGLE'
  |'HEAD_AND_SHOULDERS_BOTTOM'
  |'HEAD_AND_SHOULDERS_TOP'
  |'M_HEAD'
  |'STOCK_LINE'
  |'W_BOTTOM'
  |'BEARISH_ENGULFING'
  |'EVENING_STAR'
  |'INSIDE_BAR'
  |'LONG_WICKS'
  |'SHOOTING_STAR'

export type StockVisionDatasetDescriptor=Readonly<{
  datasetId:StockVisionDatasetId
  sourceUrl:string
  author:string
  task:'OBJECT_DETECTION'
  license:'CC BY 4.0'
  imageCount:number
  rawClasses:readonly string[]
  normalizedPatterns:readonly StockChartPattern[]
  publicModelId?:string
  reportedMetrics?:Readonly<{
    map50?:number
    precision?:number
    recall?:number
  }>
  authority:'REFERENCE_ONLY'
  canAuthorizeLive:false
}>

export const STOCK_VISION_DATASETS:Readonly<Record<StockVisionDatasetId,StockVisionDatasetDescriptor>>=Object.freeze({
  'roboflow:mod5gen20-cnkzt/stocks-2ulc2':Object.freeze({
    datasetId:'roboflow:mod5gen20-cnkzt/stocks-2ulc2',
    sourceUrl:'https://universe.roboflow.com/mod5gen20-cnkzt/stocks-2ulc2',
    author:'MOD5GEN20',
    task:'OBJECT_DETECTION',
    license:'CC BY 4.0',
    imageCount:6572,
    rawClasses:Object.freeze(['Triangle','Head and shoulders bottom','Head and shoulders top','M_Head','StockLine','W_Bottom']),
    normalizedPatterns:Object.freeze(['TRIANGLE','HEAD_AND_SHOULDERS_BOTTOM','HEAD_AND_SHOULDERS_TOP','M_HEAD','STOCK_LINE','W_BOTTOM']),
    authority:'REFERENCE_ONLY',
    canAuthorizeLive:false,
  }),
  'roboflow:glitch-gyhbu/shitty-stocks-patterns':Object.freeze({
    datasetId:'roboflow:glitch-gyhbu/shitty-stocks-patterns',
    sourceUrl:'https://universe.roboflow.com/glitch-gyhbu/shitty-stocks-patterns',
    author:'glitch',
    task:'OBJECT_DETECTION',
    license:'CC BY 4.0',
    imageCount:2000,
    rawClasses:Object.freeze(['Bearish_Engulfing','Evining-star','Inside_Bar','Long_Wicks','Shooting_Star']),
    normalizedPatterns:Object.freeze(['BEARISH_ENGULFING','EVENING_STAR','INSIDE_BAR','LONG_WICKS','SHOOTING_STAR']),
    publicModelId:'shitty-stocks-patterns/6',
    reportedMetrics:Object.freeze({map50:0.985,precision:0.942,recall:0.967}),
    authority:'REFERENCE_ONLY',
    canAuthorizeLive:false,
  }),
})

const LABELS:Readonly<Record<StockVisionDatasetId,Readonly<Record<string,StockChartPattern>>>>=Object.freeze({
  'roboflow:mod5gen20-cnkzt/stocks-2ulc2':Object.freeze({
    'Triangle':'TRIANGLE',
    'Head and shoulders bottom':'HEAD_AND_SHOULDERS_BOTTOM',
    'Head and shoulders top':'HEAD_AND_SHOULDERS_TOP',
    'M_Head':'M_HEAD',
    'StockLine':'STOCK_LINE',
    'W_Bottom':'W_BOTTOM',
  }),
  'roboflow:glitch-gyhbu/shitty-stocks-patterns':Object.freeze({
    'Bearish_Engulfing':'BEARISH_ENGULFING',
    'Evining-star':'EVENING_STAR',
    'Inside_Bar':'INSIDE_BAR',
    'Long_Wicks':'LONG_WICKS',
    'Shooting_Star':'SHOOTING_STAR',
  }),
})

export type StockVisionDetectionInput=Readonly<{
  detectionId:string
  datasetId:StockVisionDatasetId
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

export type StockVisionPatternEvidence=Readonly<{
  schemaVersion:typeof STOCK_VISION_SCHEMA_VERSION
  detectionId:string
  datasetId:StockVisionDatasetId
  modelId:string
  modelVersion:string
  rawLabel:string
  pattern:StockChartPattern
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
  authority:'RESEARCH_ONLY'
  financialAuthority:'NONE'
  canAuthorizeLive:false
}>

export type StockVisionCalibrationResult=Readonly<{
  calibrationId:string
  pattern:StockChartPattern
  modelId:string
  modelVersion:string
  sampleSize:number
  precision?:number
  recall?:number
  brierScore?:number
  evaluatedAt:string
  evidenceRefs:readonly string[]
  authority:'LEARNING_ONLY'
  canAuthorizeLive:false
}>

const nonEmpty=(value:string,code:string)=>{if(!value.trim())throw new Error(code)}
const time=(value:string,code:string)=>{const t=Date.parse(value);if(Number.isNaN(t))throw new Error(code);return t}
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')

export function normalizeStockVisionPattern(datasetId:StockVisionDatasetId,rawLabel:string):StockChartPattern{
  const result=LABELS[datasetId]?.[rawLabel]
  if(!result)throw new Error('MONEY_STOCK_VISION_UNKNOWN_LABEL')
  return result
}

export function createStockVisionPatternEvidence(input:StockVisionDetectionInput):StockVisionPatternEvidence{
  for(const [value,code] of [
    [input.detectionId,'MONEY_STOCK_VISION_DETECTION_ID_REQUIRED'],
    [input.modelId,'MONEY_STOCK_VISION_MODEL_ID_REQUIRED'],
    [input.modelVersion,'MONEY_STOCK_VISION_MODEL_VERSION_REQUIRED'],
    [input.instrumentId,'MONEY_STOCK_VISION_INSTRUMENT_REQUIRED'],
    [input.timeframe,'MONEY_STOCK_VISION_TIMEFRAME_REQUIRED'],
    [input.imageEvidenceRef,'MONEY_STOCK_VISION_IMAGE_EVIDENCE_REQUIRED'],
    [input.imageHash,'MONEY_STOCK_VISION_IMAGE_HASH_REQUIRED'],
    [input.provenanceHash,'MONEY_STOCK_VISION_PROVENANCE_REQUIRED'],
  ] as const)nonEmpty(value,code)
  if(!Number.isInteger(input.confidenceBps)||input.confidenceBps<0||input.confidenceBps>10000)throw new Error('MONEY_STOCK_VISION_CONFIDENCE_INVALID')
  if(!input.evidenceRefs.length)throw new Error('MONEY_STOCK_VISION_EVIDENCE_REQUIRED')
  const start=time(input.chartWindowStart,'MONEY_STOCK_VISION_WINDOW_START_INVALID')
  const end=time(input.chartWindowEnd,'MONEY_STOCK_VISION_WINDOW_END_INVALID')
  const inferred=time(input.inferredAt,'MONEY_STOCK_VISION_INFERRED_AT_INVALID')
  const available=time(input.availableAt,'MONEY_STOCK_VISION_AVAILABLE_AT_INVALID')
  if(end<=start)throw new Error('MONEY_STOCK_VISION_WINDOW_INVALID')
  if(inferred<end)throw new Error('MONEY_STOCK_VISION_FUTURE_WINDOW_LEAK')
  if(available<inferred)throw new Error('MONEY_STOCK_VISION_AVAILABILITY_INVALID')
  return Object.freeze({
    schemaVersion:STOCK_VISION_SCHEMA_VERSION,
    ...input,
    evidenceRefs:Object.freeze([...new Set(input.evidenceRefs)].sort()),
    pattern:normalizeStockVisionPattern(input.datasetId,input.rawLabel),
    authority:'RESEARCH_ONLY',
    financialAuthority:'NONE',
    canAuthorizeLive:false,
  })
}

export function assertStockVisionAvailableAtCutoff(evidence:StockVisionPatternEvidence,informationCutoff:string):void{
  if(time(evidence.availableAt,'MONEY_STOCK_VISION_AVAILABLE_AT_INVALID')>time(informationCutoff,'MONEY_STOCK_VISION_CUTOFF_INVALID'))throw new Error('MONEY_STOCK_VISION_FUTURE_LEAK')
}

export function createStockVisionCalibrationResult(input:Omit<StockVisionCalibrationResult,'calibrationId'|'authority'|'canAuthorizeLive'>):StockVisionCalibrationResult{
  nonEmpty(input.modelId,'MONEY_STOCK_VISION_CALIBRATION_MODEL_REQUIRED')
  nonEmpty(input.modelVersion,'MONEY_STOCK_VISION_CALIBRATION_MODEL_VERSION_REQUIRED')
  if(!Number.isInteger(input.sampleSize)||input.sampleSize<1)throw new Error('MONEY_STOCK_VISION_CALIBRATION_SAMPLE_INVALID')
  for(const [value,code] of [[input.precision,'MONEY_STOCK_VISION_PRECISION_INVALID'],[input.recall,'MONEY_STOCK_VISION_RECALL_INVALID'],[input.brierScore,'MONEY_STOCK_VISION_BRIER_INVALID']] as const){
    if(value!==undefined&&(!Number.isFinite(value)||value<0||value>1))throw new Error(code)
  }
  if(!input.evidenceRefs.length)throw new Error('MONEY_STOCK_VISION_CALIBRATION_EVIDENCE_REQUIRED')
  time(input.evaluatedAt,'MONEY_STOCK_VISION_CALIBRATION_TIME_INVALID')
  return Object.freeze({
    ...input,
    evidenceRefs:Object.freeze([...new Set(input.evidenceRefs)].sort()),
    calibrationId:'stock-vision-calibration:'+hash({pattern:input.pattern,modelId:input.modelId,modelVersion:input.modelVersion,sampleSize:input.sampleSize,evaluatedAt:input.evaluatedAt,evidenceRefs:[...input.evidenceRefs].sort()}),
    authority:'LEARNING_ONLY',
    canAuthorizeLive:false,
  })
}

export function assertStockVisionCannotAuthorizeLive(value:{authority:string;financialAuthority?:string;canAuthorizeLive:boolean}):void{
  if(value.canAuthorizeLive||value.authority==='EXECUTION'||value.financialAuthority&&value.financialAuthority!=='NONE')throw new Error('MONEY_STOCK_VISION_AUTHORITY_FORBIDDEN')
}
