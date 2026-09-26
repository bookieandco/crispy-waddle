import { createHash } from 'node:crypto'

export type MoneyAlphaDomain='STOCK'|'FOREX'|'MEME'|'CRYPTO'|'SPORTS_BETTING'|'PREDICTION_MARKET'
export type AlphaDirection='BULLISH'|'BEARISH'|'NEUTRAL'|'MIXED'
export type AlphaFeatureKind=
  |'PRICE_MISPRICING'
  |'MOMENTUM'
  |'NEWS_LATENCY'
  |'LIQUIDITY'
  |'VOLATILITY'
  |'ORDER_FLOW'
  |'MODEL_DISAGREEMENT'
  |'CORRELATION'
  |'REGIME'
  |'SETTLEMENT'
  |'RISK'

export type AlphaEvidence=Readonly<{
  alphaId:string
  sourceDomain:MoneyAlphaDomain
  sourceSubjectId:string
  sourceInstrumentId?:string
  featureKind:AlphaFeatureKind
  direction:AlphaDirection
  strengthBps:number
  confidenceBps:number
  thesis:string
  observedAt:string
  availableAt:string
  expiresAt:string
  evidenceIds:readonly string[]
  authority:'INTELLIGENCE_ONLY'
  canExecute:false
}>

export type CrossDomainAlphaRoute=Readonly<{
  routeId:string
  sourceAlphaId:string
  sourceDomain:MoneyAlphaDomain
  targetDomain:MoneyAlphaDomain
  targetInstrumentId:string
  targetHypothesis:string
  transferStatus:'REUSABLE_EVIDENCE'|'REQUIRES_REVIEW'
  reasonCodes:readonly string[]
  evidenceIds:readonly string[]
  createdAt:string
  authority:'INTELLIGENCE_ONLY'
  targetTruthClaim:false
  canAuthorizeLive:false
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const bps=(n:number,c:string)=>{if(!Number.isInteger(n)||n<0||n>10000)throw new Error(c)}
const nonEmpty=(v:string,c:string)=>{if(!v.trim())throw new Error(c)}
const iso=(v:string,c:string)=>{nonEmpty(v,c);if(Number.isNaN(Date.parse(v)))throw new Error(c)}
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

export function assertAlphaEvidence(alpha:AlphaEvidence,now?:string):void{
  nonEmpty(alpha.alphaId,'MONEY_ALPHA_ID_REQUIRED')
  nonEmpty(alpha.sourceSubjectId,'MONEY_ALPHA_SUBJECT_REQUIRED')
  nonEmpty(alpha.thesis,'MONEY_ALPHA_THESIS_REQUIRED')
  bps(alpha.strengthBps,'MONEY_ALPHA_STRENGTH_INVALID')
  bps(alpha.confidenceBps,'MONEY_ALPHA_CONFIDENCE_INVALID')
  iso(alpha.observedAt,'MONEY_ALPHA_OBSERVED_AT_INVALID')
  iso(alpha.availableAt,'MONEY_ALPHA_AVAILABLE_AT_INVALID')
  iso(alpha.expiresAt,'MONEY_ALPHA_EXPIRES_AT_INVALID')
  if(alpha.availableAt<alpha.observedAt)throw new Error('MONEY_ALPHA_AVAILABLE_BEFORE_OBSERVED')
  if(alpha.expiresAt<=alpha.availableAt)throw new Error('MONEY_ALPHA_EXPIRY_INVALID')
  if(!alpha.evidenceIds.length)throw new Error('MONEY_ALPHA_EVIDENCE_REQUIRED')
  if(alpha.authority!=='INTELLIGENCE_ONLY'||alpha.canExecute!==false)throw new Error('MONEY_ALPHA_AUTHORITY_ESCALATION')
  if(now){
    iso(now,'MONEY_ALPHA_NOW_INVALID')
    if(alpha.availableAt>now)throw new Error('MONEY_ALPHA_FUTURE_LEAK')
  }
}

export function routeAlphaAcrossDomains(input:{
  alpha:AlphaEvidence
  targetDomain:MoneyAlphaDomain
  targetInstrumentId:string
  targetHypothesis:string
  createdAt:string
  targetEvidenceIds?:readonly string[]
}):CrossDomainAlphaRoute{
  const {alpha}=input
  assertAlphaEvidence(alpha,input.createdAt)
  nonEmpty(input.targetInstrumentId,'MONEY_ALPHA_TARGET_INSTRUMENT_REQUIRED')
  nonEmpty(input.targetHypothesis,'MONEY_ALPHA_TARGET_HYPOTHESIS_REQUIRED')
  iso(input.createdAt,'MONEY_ALPHA_ROUTE_TIME_INVALID')

  const reasons:string[]=[]
  if(alpha.expiresAt<=input.createdAt)reasons.push('SOURCE_ALPHA_EXPIRED')
  if(alpha.confidenceBps<5000)reasons.push('SOURCE_CONFIDENCE_BELOW_REUSE_FLOOR')
  if(alpha.strengthBps<2500)reasons.push('SOURCE_STRENGTH_BELOW_REUSE_FLOOR')
  if(alpha.sourceDomain!==input.targetDomain)reasons.push('CROSS_DOMAIN_TRANSFER_REQUIRES_INDEPENDENT_TARGET_VALIDATION')

  const evidenceIds=unique([...alpha.evidenceIds,...(input.targetEvidenceIds??[])])
  if(!evidenceIds.length)throw new Error('MONEY_ALPHA_ROUTE_EVIDENCE_REQUIRED')
  const transferStatus:CrossDomainAlphaRoute['transferStatus']=reasons.some(r=>r!=='CROSS_DOMAIN_TRANSFER_REQUIRES_INDEPENDENT_TARGET_VALIDATION')
    ?'REQUIRES_REVIEW'
    :'REUSABLE_EVIDENCE'

  return Object.freeze({
    routeId:'money-alpha-route:'+hash({sourceAlphaId:alpha.alphaId,targetDomain:input.targetDomain,targetInstrumentId:input.targetInstrumentId,targetHypothesis:input.targetHypothesis,createdAt:input.createdAt}),
    sourceAlphaId:alpha.alphaId,
    sourceDomain:alpha.sourceDomain,
    targetDomain:input.targetDomain,
    targetInstrumentId:input.targetInstrumentId,
    targetHypothesis:input.targetHypothesis,
    transferStatus,
    reasonCodes:Object.freeze(reasons),
    evidenceIds,
    createdAt:input.createdAt,
    authority:'INTELLIGENCE_ONLY',
    targetTruthClaim:false,
    canAuthorizeLive:false,
    canExecute:false,
  })
}
