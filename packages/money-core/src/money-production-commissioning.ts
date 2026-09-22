import { createHash } from 'node:crypto'

export type MoneyProductionLane='STOCK'|'FOREX'|'SHARK_MEME'|'SPORTS_BETTING'
export type MoneyProductionPlatformReceiptKind='DATABASE_SCHEMA'|'PRODUCTION_DEPLOYMENT'

export type MoneyProductionReceiptKind=
  |'SOFTWARE_CERTIFICATION'
  |'MARKET_DATA'
  |'PROVIDER_CONFIGURATION'
  |'CREDENTIAL_VERIFICATION'
  |'LIVE_CANARY'
  |'RECONCILIATION'
  |'KILL_SWITCH'
  |'SHADOW_SOAK'

export type MoneyProductionCommissioningReceipt=Readonly<{
  receiptId:string
  lane:MoneyProductionLane
  kind:MoneyProductionReceiptKind
  provider:string
  environment:'PAPER'|'SHADOW'|'LIVE'
  passed:boolean
  recordedAt:string
  evidenceIds:readonly string[]
  issuer:'MONEY_CERTIFICATION'|'PROVIDER_RUNTIME'|'OPERATIONS'
  authority:'CERTIFICATION_ONLY'
  canExecute:false
}>

export type MoneyProductionPlatformReceipt=Readonly<{
  receiptId:string
  kind:MoneyProductionPlatformReceiptKind
  environment:'LIVE'
  passed:boolean
  revision?:string
  recordedAt:string
  evidenceIds:readonly string[]
  issuer:'MONEY_CERTIFICATION'|'OPERATIONS'
  authority:'CERTIFICATION_ONLY'
  canExecute:false
}>

export type MoneyShadowSoakDomainResult=Readonly<{
  lane:MoneyProductionLane
  sampleSize:number
  resolvedSampleSize:number
  maxDrawdownBps:number
  unresolvedExecutions:number
  duplicateExecutionCount:number
  futureLeakCount:number
  authorityEscalationCount:number
  crossDomainTruthContaminationCount:number
  evidenceIds:readonly string[]
}>

export type MoneyShadowSoakReport=Readonly<{
  soakId:string
  domains:readonly MoneyShadowSoakDomainResult[]
  minimumSamplesPerLane:number
  minimumResolutionRateBps:number
  maximumDrawdownBps:number
  passed:boolean
  reasonCodes:readonly string[]
  evidenceIds:readonly string[]
  authority:'CERTIFICATION_ONLY'
  canExecute:false
}>

export type MoneyProductionLaneStatus='BLOCKED_SOFTWARE'|'EXTERNAL_COMMISSIONING_REQUIRED'|'LIVE_ACCEPTED'

export type MoneyProductionLaneAssessment=Readonly<{
  lane:MoneyProductionLane
  status:MoneyProductionLaneStatus
  provider?:string
  reasonCodes:readonly string[]
  receiptIds:readonly string[]
  evidenceIds:readonly string[]
  authority:'CERTIFICATION_ONLY'
  canExecute:false
}>

export type MoneyProdFinalReport=Readonly<{
  reportId:string
  softwareComplete:boolean
  productionAccepted:boolean
  status:'BLOCKED_SOFTWARE'|'SOFTWARE_COMPLETE_EXTERNAL_COMMISSIONING_REQUIRED'|'PRODUCTION_ACCEPTED'
  lanes:readonly MoneyProductionLaneAssessment[]
  platformReceiptIds:readonly string[]
  blockers:readonly string[]
  receiptIds:readonly string[]
  evidenceIds:readonly string[]
  generatedAt:string
  authority:'CERTIFICATION_ONLY'
  canExecute:false
}>

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const iso=(value:string,code:string)=>{if(Number.isNaN(Date.parse(value)))throw new Error(code)}
const unique=(values:readonly string[])=>Object.freeze([...new Set(values)].sort())

export const MONEY_PROD_REQUIRED_LANES:readonly MoneyProductionLane[]=Object.freeze(['STOCK','FOREX','SHARK_MEME','SPORTS_BETTING'])

export function createMoneyProductionCommissioningReceipt(input:Omit<MoneyProductionCommissioningReceipt,'receiptId'|'authority'|'canExecute'>):MoneyProductionCommissioningReceipt{
  if(!input.provider.trim())throw new Error('MONEY_PROD_PROVIDER_REQUIRED')
  iso(input.recordedAt,'MONEY_PROD_RECEIPT_TIME_INVALID')
  if(!input.evidenceIds.length)throw new Error('MONEY_PROD_RECEIPT_EVIDENCE_REQUIRED')
  if(input.kind==='LIVE_CANARY'&&input.environment!=='LIVE')throw new Error('MONEY_PROD_LIVE_CANARY_ENVIRONMENT_REQUIRED')
  if(input.kind==='MARKET_DATA'&&input.lane==='FOREX'&&input.provider==='finnhub'&&input.environment==='LIVE'){
    // LIVE means current market data, not execution authority.
  }
  return Object.freeze({
    ...input,
    evidenceIds:unique(input.evidenceIds),
    receiptId:'money-prod-receipt:'+hash({lane:input.lane,kind:input.kind,provider:input.provider,environment:input.environment,passed:input.passed,recordedAt:input.recordedAt,evidenceIds:[...input.evidenceIds].sort(),issuer:input.issuer}),
    authority:'CERTIFICATION_ONLY',
    canExecute:false,
  })
}

export function createMoneyProductionPlatformReceipt(input:Omit<MoneyProductionPlatformReceipt,'receiptId'|'authority'|'canExecute'>):MoneyProductionPlatformReceipt{
  iso(input.recordedAt,'MONEY_PROD_PLATFORM_RECEIPT_TIME_INVALID')
  if(!input.evidenceIds.length)throw new Error('MONEY_PROD_PLATFORM_RECEIPT_EVIDENCE_REQUIRED')
  if(input.kind==='PRODUCTION_DEPLOYMENT'&&!input.revision?.trim())throw new Error('MONEY_PROD_DEPLOYMENT_REVISION_REQUIRED')
  return Object.freeze({...input,evidenceIds:unique(input.evidenceIds),receiptId:'money-prod-platform:'+hash({kind:input.kind,passed:input.passed,revision:input.revision??null,recordedAt:input.recordedAt,evidenceIds:[...input.evidenceIds].sort(),issuer:input.issuer}),authority:'CERTIFICATION_ONLY',canExecute:false})
}

export function certifyMoneyShadowSoak(input:{
  domains:readonly MoneyShadowSoakDomainResult[]
  minimumSamplesPerLane:number
  minimumResolutionRateBps:number
  maximumDrawdownBps:number
}):MoneyShadowSoakReport{
  if(!Number.isInteger(input.minimumSamplesPerLane)||input.minimumSamplesPerLane<1)throw new Error('MONEY_PROD_SOAK_MIN_SAMPLE_INVALID')
  if(!Number.isInteger(input.minimumResolutionRateBps)||input.minimumResolutionRateBps<0||input.minimumResolutionRateBps>10000)throw new Error('MONEY_PROD_SOAK_RESOLUTION_RATE_INVALID')
  if(!Number.isInteger(input.maximumDrawdownBps)||input.maximumDrawdownBps<0||input.maximumDrawdownBps>10000)throw new Error('MONEY_PROD_SOAK_DRAWDOWN_LIMIT_INVALID')
  const reasons:string[]=[]
  const seen=new Set<MoneyProductionLane>()
  for(const d of input.domains){
    if(seen.has(d.lane))reasons.push('DUPLICATE_LANE:'+d.lane)
    seen.add(d.lane)
    if(!Number.isInteger(d.sampleSize)||d.sampleSize<0||!Number.isInteger(d.resolvedSampleSize)||d.resolvedSampleSize<0||d.resolvedSampleSize>d.sampleSize)reasons.push('SAMPLE_INVALID:'+d.lane)
    if(d.sampleSize<input.minimumSamplesPerLane)reasons.push('SAMPLE_TOO_SMALL:'+d.lane)
    const resolutionRate=d.sampleSize?Math.floor(d.resolvedSampleSize*10000/d.sampleSize):0
    if(resolutionRate<input.minimumResolutionRateBps)reasons.push('RESOLUTION_RATE_LOW:'+d.lane)
    if(d.maxDrawdownBps>input.maximumDrawdownBps)reasons.push('DRAWDOWN_EXCEEDED:'+d.lane)
    if(d.unresolvedExecutions>0)reasons.push('UNRESOLVED_EXECUTIONS:'+d.lane)
    if(d.duplicateExecutionCount>0)reasons.push('DUPLICATE_EXECUTIONS:'+d.lane)
    if(d.futureLeakCount>0)reasons.push('FUTURE_LEAK:'+d.lane)
    if(d.authorityEscalationCount>0)reasons.push('AUTHORITY_ESCALATION:'+d.lane)
    if(d.crossDomainTruthContaminationCount>0)reasons.push('CROSS_DOMAIN_TRUTH_CONTAMINATION:'+d.lane)
    if(!d.evidenceIds.length)reasons.push('EVIDENCE_REQUIRED:'+d.lane)
  }
  for(const lane of MONEY_PROD_REQUIRED_LANES)if(!seen.has(lane))reasons.push('LANE_MISSING:'+lane)
  const evidenceIds=unique(input.domains.flatMap(x=>x.evidenceIds))
  const reasonCodes=unique(reasons)
  return Object.freeze({
    soakId:'money-prod-soak:'+hash({domains:input.domains,minimumSamplesPerLane:input.minimumSamplesPerLane,minimumResolutionRateBps:input.minimumResolutionRateBps,maximumDrawdownBps:input.maximumDrawdownBps}),
    domains:Object.freeze(input.domains.map(x=>Object.freeze({...x,evidenceIds:unique(x.evidenceIds)}))),
    minimumSamplesPerLane:input.minimumSamplesPerLane,
    minimumResolutionRateBps:input.minimumResolutionRateBps,
    maximumDrawdownBps:input.maximumDrawdownBps,
    passed:reasonCodes.length===0,
    reasonCodes,
    evidenceIds,
    authority:'CERTIFICATION_ONLY',
    canExecute:false,
  })
}

function receiptMap(receipts:readonly MoneyProductionCommissioningReceipt[],lane:MoneyProductionLane){
  return new Map(receipts.filter(x=>x.lane===lane&&x.passed).map(x=>[x.kind,x] as const))
}

function evaluateLane(lane:MoneyProductionLane,receipts:readonly MoneyProductionCommissioningReceipt[],soak:MoneyShadowSoakReport):MoneyProductionLaneAssessment{
  const r=receiptMap(receipts,lane),reasons:string[]=[]
  const software=r.get('SOFTWARE_CERTIFICATION')
  if(!software)reasons.push('SOFTWARE_CERTIFICATION_REQUIRED')
  if(!soak.passed)reasons.push('SHADOW_SOAK_REQUIRED')

  if(lane==='STOCK'){
    const provider=r.get('PROVIDER_CONFIGURATION')
    if(!provider)reasons.push('ALPACA_PROVIDER_CONFIGURATION_REQUIRED')
    else if(provider.provider!=='alpaca')reasons.push('ALPACA_PROVIDER_REQUIRED')
    if(!r.get('CREDENTIAL_VERIFICATION'))reasons.push('LIVE_CREDENTIAL_VERIFICATION_REQUIRED')
    if(!r.get('LIVE_CANARY'))reasons.push('TINY_LIVE_CANARY_REQUIRED')
    if(!r.get('RECONCILIATION'))reasons.push('LIVE_RECONCILIATION_REQUIRED')
    if(!r.get('KILL_SWITCH'))reasons.push('KILL_SWITCH_DRILL_REQUIRED')
  }else if(lane==='FOREX'){
    if(!r.get('MARKET_DATA'))reasons.push('FOREX_MARKET_DATA_REQUIRED')
    const provider=r.get('PROVIDER_CONFIGURATION')
    if(!provider)reasons.push('FOREX_EXECUTION_PROVIDER_REQUIRED')
    else if(provider.provider==='finnhub')reasons.push('FINNHUB_CANNOT_EXECUTE')
    if(!r.get('CREDENTIAL_VERIFICATION'))reasons.push('FOREX_LIVE_CREDENTIAL_VERIFICATION_REQUIRED')
    if(!r.get('LIVE_CANARY'))reasons.push('FOREX_TINY_LIVE_CANARY_REQUIRED')
    if(!r.get('RECONCILIATION'))reasons.push('FOREX_RECONCILIATION_REQUIRED')
    if(!r.get('KILL_SWITCH'))reasons.push('FOREX_KILL_SWITCH_DRILL_REQUIRED')
  }else if(lane==='SHARK_MEME'){
    const provider=r.get('PROVIDER_CONFIGURATION')
    if(!provider)reasons.push('DEX_EXECUTION_PROVIDER_REQUIRED')
    if(!r.get('CREDENTIAL_VERIFICATION'))reasons.push('DEDICATED_TRADING_WALLET_VERIFICATION_REQUIRED')
    if(!r.get('LIVE_CANARY'))reasons.push('DEX_TINY_LIVE_CANARY_REQUIRED')
    if(!r.get('RECONCILIATION'))reasons.push('ONCHAIN_RECONCILIATION_REQUIRED')
    if(!r.get('KILL_SWITCH'))reasons.push('DEX_KILL_SWITCH_DRILL_REQUIRED')
  }else{
    const provider=r.get('PROVIDER_CONFIGURATION')
    if(!provider)reasons.push('SPORTSBOOK_EXECUTION_PROVIDER_REQUIRED')
    if(!r.get('CREDENTIAL_VERIFICATION'))reasons.push('SPORTSBOOK_CREDENTIAL_VERIFICATION_REQUIRED')
    if(!r.get('LIVE_CANARY'))reasons.push('SPORTSBOOK_TINY_LIVE_CANARY_REQUIRED')
    if(!r.get('RECONCILIATION'))reasons.push('WAGER_SETTLEMENT_RECONCILIATION_REQUIRED')
    if(!r.get('KILL_SWITCH'))reasons.push('BETTING_KILL_SWITCH_DRILL_REQUIRED')
  }

  const laneReceipts=receipts.filter(x=>x.lane===lane)
  const softwareBlocked=!software
  const status:MoneyProductionLaneStatus=softwareBlocked?'BLOCKED_SOFTWARE':reasons.length?'EXTERNAL_COMMISSIONING_REQUIRED':'LIVE_ACCEPTED'
  return Object.freeze({
    lane,status,provider:r.get('PROVIDER_CONFIGURATION')?.provider,
    reasonCodes:unique(reasons),
    receiptIds:unique(laneReceipts.map(x=>x.receiptId)),
    evidenceIds:unique([...laneReceipts.flatMap(x=>x.evidenceIds),...soak.domains.filter(x=>x.lane===lane).flatMap(x=>x.evidenceIds)]),
    authority:'CERTIFICATION_ONLY',canExecute:false,
  })
}

export function certifyMoneyProdFinal(input:{
  receipts:readonly MoneyProductionCommissioningReceipt[]
  shadowSoak:MoneyShadowSoakReport
  platformReceipts:readonly MoneyProductionPlatformReceipt[]
  generatedAt:string
}):MoneyProdFinalReport{
  iso(input.generatedAt,'MONEY_PROD_GENERATED_AT_INVALID')
  const receiptIds=new Set<string>()
  for(const r of input.receipts){
    if(r.authority!=='CERTIFICATION_ONLY'||r.canExecute!==false)throw new Error('MONEY_PROD_RECEIPT_AUTHORITY_FORBIDDEN')
    if(receiptIds.has(r.receiptId))throw new Error('MONEY_PROD_DUPLICATE_RECEIPT')
    receiptIds.add(r.receiptId)
  }
  if(input.shadowSoak.authority!=='CERTIFICATION_ONLY'||input.shadowSoak.canExecute!==false)throw new Error('MONEY_PROD_SOAK_AUTHORITY_FORBIDDEN')
  const platformIds=new Set<string>()
  for(const r of input.platformReceipts){
    if(r.authority!=='CERTIFICATION_ONLY'||r.canExecute!==false)throw new Error('MONEY_PROD_PLATFORM_RECEIPT_AUTHORITY_FORBIDDEN')
    if(platformIds.has(r.receiptId))throw new Error('MONEY_PROD_DUPLICATE_PLATFORM_RECEIPT')
    platformIds.add(r.receiptId)
  }
  const lanes=Object.freeze(MONEY_PROD_REQUIRED_LANES.map(lane=>evaluateLane(lane,input.receipts,input.shadowSoak)))
  const softwareComplete=lanes.every(x=>x.status!=='BLOCKED_SOFTWARE')
  const platformPassed=new Map(input.platformReceipts.filter(x=>x.passed).map(x=>[x.kind,x] as const))
  const platformBlockers:string[]=[]
  if(!platformPassed.get('DATABASE_SCHEMA'))platformBlockers.push('PLATFORM:COMMISSIONING_DATABASE_SCHEMA_REQUIRED')
  if(!platformPassed.get('PRODUCTION_DEPLOYMENT'))platformBlockers.push('PLATFORM:CURRENT_PRODUCTION_DEPLOYMENT_REQUIRED')
  const productionAccepted=softwareComplete&&input.shadowSoak.passed&&platformBlockers.length===0&&lanes.every(x=>x.status==='LIVE_ACCEPTED')
  const blockers=unique([...lanes.flatMap(x=>x.reasonCodes.map(reason=>x.lane+':'+reason)),...platformBlockers])
  const status:MoneyProdFinalReport['status']=!softwareComplete?'BLOCKED_SOFTWARE':productionAccepted?'PRODUCTION_ACCEPTED':'SOFTWARE_COMPLETE_EXTERNAL_COMMISSIONING_REQUIRED'
  return Object.freeze({
    reportId:'money-prod-final:'+hash({receipts:[...input.receipts].map(x=>x.receiptId).sort(),soak:input.shadowSoak.soakId,generatedAt:input.generatedAt}),
    softwareComplete,productionAccepted,status,lanes,platformReceiptIds:unique(input.platformReceipts.map(x=>x.receiptId)),blockers,
    receiptIds:unique(input.receipts.map(x=>x.receiptId)),
    evidenceIds:unique([...input.receipts.flatMap(x=>x.evidenceIds),...input.platformReceipts.flatMap(x=>x.evidenceIds),...input.shadowSoak.evidenceIds]),
    generatedAt:input.generatedAt,authority:'CERTIFICATION_ONLY',canExecute:false,
  })
}
