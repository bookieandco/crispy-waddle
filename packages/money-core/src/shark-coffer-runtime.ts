import {createHash} from 'node:crypto'
import {
  bindMakeItMakeSenseStage,
  makeItMakeSense,
  type MakeItMakeSenseCheck,
  type StagedMakeItMakeSenseVote,
} from '@jhadina/core-spine'
import {
  assessThesisDialectically,
  buildFinancialThesis,
  createOpportunityFromThesis,
} from './cross-asset-fusion-engine.js'
import type {
  DialecticalAssessment,
  FinancialThesis,
  FusionEvidence,
  OpportunityCandidateV2,
  ThesisAssumption,
} from './cross-asset-fusion-contracts.js'
import {
  ingestSharkResearch,
  sharkResearchToFusionEvidence,
  type SharkMoneyResearchArtifact,
  type SharkMoneyTransportEnvelope,
  type SharkResearchIngressContext,
} from './shark-intelligence-ingress.js'
import type {SharkPurseMoneyValidation} from './shark-purse-bridge.js'

export const SHARK_COFFER_RUNTIME_VERSION='SHARK-COFFER.RUNTIME-01' as const

export type SharkMoneyRuntimeMarketEvidence=Readonly<{
  evidenceId:string
  assessmentId:string
  chainId:string
  tokenAddress:string
  source:string
  liquidityUsd:number
  volume24hUsd:number
  buys24h:number
  sells24h:number
  anomalyScore:number
  observedAt:string
  availableAt:string
  evidenceIds:readonly string[]
  payloadHash:string
  authority:'EVIDENCE_ONLY'
  canExecute:false
}>

export type SharkCofferRuntimePolicy=Readonly<{
  policyId:string
  strategyId:string
  modelId:string
  modelVersion:string
  methodologyVersion:string
  minLiquidityUsd:number
  minCalibrationSamples:number
  minEvidenceQualityBps:number
  maxLiquidityParticipationBps:number
  minimumCapitalMinor:bigint
  opportunityExpiresAt:string
  authority:'POLICY_ONLY'
  canExecute:false
}>

export type SharkCofferRuntimeResearch=Readonly<{
  runtimeVersion:typeof SHARK_COFFER_RUNTIME_VERSION
  sourceEnvelopeId:string
  sourceAssessmentId:string
  instrumentId:string
  research:SharkMoneyResearchArtifact
  fusionEvidence:readonly FusionEvidence[]
  thesis:FinancialThesis
  dialectic:DialecticalAssessment
  opportunity?:OpportunityCandidateV2
  tradeMims?:StagedMakeItMakeSenseVote<'TRADE'>
  validation?:SharkPurseMoneyValidation
  disposition:'MONEY_OPPORTUNITY_READY'|'RESEARCH_ONLY'|'BLOCKED'
  reasonCodes:readonly string[]
  informationCutoff:string
  evidenceIds:readonly string[]
  authority:'MONEY_RESEARCH_ONLY'
  canExecute:false
}>

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
const iso=(v:string,code:string)=>{if(!v||Number.isNaN(Date.parse(v)))throw new Error(code)}
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())
const finite=(n:number,code:string)=>{if(!Number.isFinite(n)||n<0)throw new Error(code)}
const later=(a:string,b:string)=>Date.parse(a)>=Date.parse(b)?a:b

export function assertSharkMoneyRuntimeMarketEvidence(e:SharkMoneyRuntimeMarketEvidence):void{
  for(const [v,c] of [[e.evidenceId,'MONEY_SHARK_RUNTIME_MARKET_ID_REQUIRED'],[e.assessmentId,'MONEY_SHARK_RUNTIME_ASSESSMENT_REQUIRED'],[e.chainId,'MONEY_SHARK_RUNTIME_CHAIN_REQUIRED'],[e.tokenAddress,'MONEY_SHARK_RUNTIME_TOKEN_REQUIRED'],[e.source,'MONEY_SHARK_RUNTIME_SOURCE_REQUIRED'],[e.payloadHash,'MONEY_SHARK_RUNTIME_PAYLOAD_HASH_REQUIRED']] as const){
    if(!v.trim())throw new Error(c)
  }
  for(const [n,c] of [[e.liquidityUsd,'MONEY_SHARK_RUNTIME_LIQUIDITY_INVALID'],[e.volume24hUsd,'MONEY_SHARK_RUNTIME_VOLUME_INVALID'],[e.buys24h,'MONEY_SHARK_RUNTIME_BUYS_INVALID'],[e.sells24h,'MONEY_SHARK_RUNTIME_SELLS_INVALID'],[e.anomalyScore,'MONEY_SHARK_RUNTIME_ANOMALY_INVALID']] as const)finite(n,c)
  if(e.anomalyScore>1)throw new Error('MONEY_SHARK_RUNTIME_ANOMALY_INVALID')
  iso(e.observedAt,'MONEY_SHARK_RUNTIME_MARKET_OBSERVED_AT_INVALID')
  iso(e.availableAt,'MONEY_SHARK_RUNTIME_MARKET_AVAILABLE_AT_INVALID')
  if(e.availableAt<e.observedAt)throw new Error('MONEY_SHARK_RUNTIME_MARKET_TIME_ORDER_INVALID')
  if(!e.evidenceIds.length)throw new Error('MONEY_SHARK_RUNTIME_MARKET_EVIDENCE_REQUIRED')
  if(e.authority!=='EVIDENCE_ONLY'||e.canExecute!==false)throw new Error('MONEY_SHARK_RUNTIME_MARKET_AUTHORITY_INVALID')
}

export function assertSharkCofferRuntimePolicy(p:SharkCofferRuntimePolicy,now:string):void{
  for(const [v,c] of [[p.policyId,'MONEY_SHARK_RUNTIME_POLICY_ID_REQUIRED'],[p.strategyId,'MONEY_SHARK_RUNTIME_STRATEGY_REQUIRED'],[p.modelId,'MONEY_SHARK_RUNTIME_MODEL_REQUIRED'],[p.modelVersion,'MONEY_SHARK_RUNTIME_MODEL_VERSION_REQUIRED'],[p.methodologyVersion,'MONEY_SHARK_RUNTIME_METHODOLOGY_REQUIRED']] as const){
    if(!v.trim())throw new Error(c)
  }
  finite(p.minLiquidityUsd,'MONEY_SHARK_RUNTIME_POLICY_LIQUIDITY_INVALID')
  if(!Number.isInteger(p.minCalibrationSamples)||p.minCalibrationSamples<1)throw new Error('MONEY_SHARK_RUNTIME_CALIBRATION_FLOOR_INVALID')
  if(!Number.isInteger(p.minEvidenceQualityBps)||p.minEvidenceQualityBps<0||p.minEvidenceQualityBps>10000)throw new Error('MONEY_SHARK_RUNTIME_EVIDENCE_FLOOR_INVALID')
  if(!Number.isInteger(p.maxLiquidityParticipationBps)||p.maxLiquidityParticipationBps<1||p.maxLiquidityParticipationBps>1000)throw new Error('MONEY_SHARK_RUNTIME_PARTICIPATION_INVALID')
  if(p.minimumCapitalMinor<=0n)throw new Error('MONEY_SHARK_RUNTIME_MIN_CAPITAL_INVALID')
  iso(p.opportunityExpiresAt,'MONEY_SHARK_RUNTIME_EXPIRY_INVALID')
  if(p.opportunityExpiresAt<=now)throw new Error('MONEY_SHARK_RUNTIME_EXPIRY_NOT_FUTURE')
  if(p.authority!=='POLICY_ONLY'||p.canExecute!==false)throw new Error('MONEY_SHARK_RUNTIME_POLICY_AUTHORITY_INVALID')
}

function marketFusionEvidence(input:{
  research:SharkMoneyResearchArtifact
  market:SharkMoneyRuntimeMarketEvidence
  instrumentId:string
  expiresAt:string
  policy:SharkCofferRuntimePolicy
}):FusionEvidence{
  const {research,market,policy}=input
  const liquidityRatio=policy.minLiquidityUsd<=0?1:market.liquidityUsd/policy.minLiquidityUsd
  const liquidityStrength=clamp(Math.log10(Math.max(1,liquidityRatio))+0.5,0,1)
  const totalFlow=market.buys24h+market.sells24h
  const buyShare=totalFlow>0?market.buys24h/totalFlow:.5
  const direction=buyShare>.55?'BULLISH' as const:buyShare<.45?'BEARISH' as const:'NEUTRAL' as const
  const stance=market.liquidityUsd>=policy.minLiquidityUsd&&market.anomalyScore<.5?'SUPPORTS' as const:market.liquidityUsd<policy.minLiquidityUsd||market.anomalyScore>=.8?'CONTRADICTS' as const:'NEUTRAL' as const
  return Object.freeze({
    evidenceId:'fusion-evidence:money-market:'+market.evidenceId,
    domain:'MARKET',
    subjectId:research.subjectId,
    instrumentId:input.instrumentId,
    assetClass:'MEME',
    stance,
    direction,
    strength:clamp((liquidityStrength+(1-market.anomalyScore))/2,0,1),
    confidence:clamp(.55+Math.min(.35,Math.log10(Math.max(1,market.volume24hUsd+1))/20),0,1),
    effectiveAt:market.observedAt,
    availableAt:market.availableAt,
    expiresAt:input.expiresAt,
    sourceGroup:'money:raw-market:'+market.source,
    inputHash:market.payloadHash,
    provenanceHash:hash({market:market.evidenceId,source:market.source,payloadHash:market.payloadHash,policy:policy.policyId}),
    authority:'NONE',
  })
}

function evidenceQualityBps(evidence:readonly FusionEvidence[]):number{
  if(!evidence.length)return 0
  return clamp(Math.round(evidence.reduce((n,e)=>n+(e.strength*e.confidence),0)/evidence.length*10000),0,10000)
}

function liquidityBps(liquidityUsd:number,minimum:number):number{
  if(liquidityUsd<=0)return 0
  const base=Math.log10(Math.max(1,liquidityUsd))/6
  const floorPenalty=liquidityUsd<minimum?liquidityUsd/Math.max(1,minimum):1
  return clamp(Math.round(base*floorPenalty*10000),0,10000)
}

function expectedEconomics(input:{
  research:SharkMoneyResearchArtifact
  market:SharkMoneyRuntimeMarketEvidence
  evidenceQualityBps:number
}):Readonly<{upside:number;downside:number}>{
  const flowTotal=input.market.buys24h+input.market.sells24h
  const flowSkew=flowTotal>0?(input.market.buys24h-input.market.sells24h)/flowTotal:0
  const turnover=Math.min(4,input.market.volume24hUsd/Math.max(1,input.market.liquidityUsd))
  const sourceQuality=input.research.sourceConfidence*(1-input.research.sourceRisk.overallRisk)
  const evidenceQuality=input.evidenceQualityBps/10000
  const upside=clamp(.01+sourceQuality*.08+Math.max(0,flowSkew)*.04+turnover*.0075+evidenceQuality*.025,.01,.25)
  const downside=-clamp(.04+input.research.sourceRisk.overallRisk*.22+input.market.anomalyScore*.14+Math.max(0,-flowSkew)*.05,.04,.4)
  return Object.freeze({upside,downside})
}

function makeTradeMims(input:{
  research:SharkMoneyResearchArtifact
  opportunity:OpportunityCandidateV2
  evidence:readonly FusionEvidence[]
  market:SharkMoneyRuntimeMarketEvidence
  policy:SharkCofferRuntimePolicy
  calibrationSampleSize:number
}):StagedMakeItMakeSenseVote<'TRADE'>{
  const groups=new Set(input.evidence.map(e=>e.sourceGroup))
  const quality=evidenceQualityBps(input.evidence)
  const checks:MakeItMakeSenseCheck[]=[
    {dimension:'EVIDENCE',status:groups.size>=2&&quality>=input.policy.minEvidenceQualityBps?'PASS':'REVIEW',rationale:groups.size>=2?'Money retained multiple evidence groups and scored evidence quality independently.':'Only one independent evidence group is available.',evidenceRefs:input.evidence.map(e=>e.evidenceId)},
    {dimension:'CHRONOLOGY',status:input.evidence.every(e=>e.availableAt<=input.opportunity.informationCutoff)?'PASS':'FAIL',rationale:'All admitted evidence must have been available by the opportunity information cutoff.',evidenceRefs:input.evidence.map(e=>e.evidenceId)},
    {dimension:'CAUSAL_LOGIC',status:input.research.invalidationConditions.length?'PASS':'REVIEW',rationale:'The thesis is probabilistic rather than a claim of causation and carries explicit invalidation conditions.',evidenceRefs:[...input.research.evidenceIntegrity.supportingEvidenceIds]},
    {dimension:'INCENTIVES',status:input.research.sourceRisk.band==='candidate'||input.research.sourceRisk.band==='watch'?'PASS':'REVIEW',rationale:'Actor/supply/liquidity incentives remain represented by SHARK risk evidence and are independently bounded by Money risk policy.',evidenceRefs:[...input.research.evidence.map(e=>e.evidenceId)]},
    {dimension:'BASE_RATES',status:input.calibrationSampleSize>=input.policy.minCalibrationSamples?'PASS':'REVIEW',rationale:input.calibrationSampleSize>=input.policy.minCalibrationSamples?'Strategy has sufficient resolved calibration samples for this policy.':'Strategy has not accumulated the policy minimum number of resolved calibration samples.',evidenceRefs:['calibration-samples:'+String(input.calibrationSampleSize)]},
    {dimension:'CONTRADICTIONS',status:input.research.evidenceIntegrity.unresolvedContradictionIds.length?'FAIL':'PASS',rationale:input.research.evidenceIntegrity.unresolvedContradictionIds.length?'Unresolved contradictory evidence remains.':'No unresolved SHARK contradiction remains at this cutoff.',evidenceRefs:[...input.research.evidenceIntegrity.unresolvedContradictionIds,...input.research.evidenceIntegrity.contradictingEvidenceIds]},
    {dimension:'ALTERNATIVES',status:'PASS',rationale:'No-trade, later-entry and keep-cash alternatives remain available because this vote has no execution authority.',evidenceRefs:[input.opportunity.opportunityId]},
  ]
  const vote=makeItMakeSense({
    voteId:'mims:trade:'+hash({opportunityId:input.opportunity.opportunityId,checks,policy:input.policy.policyId}),
    subjectId:input.opportunity.opportunityId,
    checks,
  })
  return bindMakeItMakeSenseStage({stage:'TRADE',vote,expectedSubjectId:input.opportunity.opportunityId})
}

export function buildSharkCofferRuntimeResearch(input:Readonly<{
  envelope:SharkMoneyTransportEnvelope
  ingressContext:SharkResearchIngressContext
  market:SharkMoneyRuntimeMarketEvidence
  policy:SharkCofferRuntimePolicy
  calibrationSampleSize:number
  createdAt:string
}>):SharkCofferRuntimeResearch{
  iso(input.createdAt,'MONEY_SHARK_RUNTIME_CREATED_AT_INVALID')
  assertSharkMoneyRuntimeMarketEvidence(input.market)
  assertSharkCofferRuntimePolicy(input.policy,input.createdAt)
  if(!Number.isInteger(input.calibrationSampleSize)||input.calibrationSampleSize<0)throw new Error('MONEY_SHARK_RUNTIME_CALIBRATION_SAMPLE_INVALID')
  if(input.market.assessmentId!==input.envelope.assessment.assessmentId||input.market.chainId!==input.envelope.assessment.chainId||input.market.tokenAddress!==input.envelope.assessment.tokenAddress)throw new Error('MONEY_SHARK_RUNTIME_MARKET_BINDING_MISMATCH')

  const research=ingestSharkResearch(input.envelope,input.ingressContext)
  const instrumentId='meme:'+research.chainId+':'+research.tokenAddress
  const cutoff=later(research.informationCutoff,input.market.availableAt)
  if(cutoff>input.createdAt)throw new Error('MONEY_SHARK_RUNTIME_FUTURE_EVIDENCE')
  const sharkEvidence=sharkResearchToFusionEvidence({artifact:research,instrumentId,expiresAt:input.policy.opportunityExpiresAt})
  const moneyMarket=marketFusionEvidence({research,market:input.market,instrumentId,expiresAt:input.policy.opportunityExpiresAt,policy:input.policy})
  const fusionEvidence=Object.freeze([...sharkEvidence,moneyMarket].sort((a,b)=>a.evidenceId.localeCompare(b.evidenceId)))

  const assumptions:readonly ThesisAssumption[]=Object.freeze([
    Object.freeze({
      assumptionId:'assumption:liquidity:'+input.market.evidenceId,
      statement:'Observed liquidity remains above the Money runtime minimum through the intended entry window.',
      status:input.market.liquidityUsd>=input.policy.minLiquidityUsd?'ACTIVE':'INVALIDATED',
      evidenceIds:Object.freeze([moneyMarket.evidenceId]),
    }),
    Object.freeze({
      assumptionId:'assumption:invalidation:'+research.sourceAssessmentId,
      statement:'The source thesis remains falsifiable by its recorded invalidation conditions.',
      status:research.invalidationConditions.length?'ACTIVE':'CHALLENGED',
      evidenceIds:Object.freeze([...research.evidence.map(e=>e.evidenceId)]),
    }),
  ])

  const thesis=buildFinancialThesis({
    subjectId:research.subjectId,
    instrumentIds:[instrumentId],
    assetClasses:['MEME'],
    direction:'BULLISH',
    horizon:'INTRADAY',
    statement:research.thesis,
    evidence:fusionEvidence,
    assumptions,
    informationCutoff:cutoff,
    createdAt:input.createdAt,
    expiresAt:input.policy.opportunityExpiresAt,
    modelId:input.policy.modelId,
    modelVersion:input.policy.modelVersion,
    methodologyVersion:input.policy.methodologyVersion,
  })
  const dialectic=assessThesisDialectically(thesis,fusionEvidence,research.evidenceIntegrity.unresolvedContradictionIds)
  const reasons:string[]=[]
  if(input.market.liquidityUsd<input.policy.minLiquidityUsd)reasons.push('MONEY_LIQUIDITY_BELOW_RUNTIME_FLOOR')
  const eq=evidenceQualityBps(fusionEvidence)
  if(eq<input.policy.minEvidenceQualityBps)reasons.push('MONEY_EVIDENCE_QUALITY_BELOW_RUNTIME_FLOOR')
  if(dialectic.status!=='SUPPORTED')reasons.push('MONEY_DIALECTIC_NOT_SUPPORTED')

  let opportunity:OpportunityCandidateV2|undefined
  let tradeMims:StagedMakeItMakeSenseVote<'TRADE'>|undefined
  let validation:SharkPurseMoneyValidation|undefined
  if(!reasons.length){
    const economics=expectedEconomics({research,market:input.market,evidenceQualityBps:eq})
    opportunity=createOpportunityFromThesis({
      thesis,
      assessment:dialectic,
      expectedUpside:economics.upside,
      expectedDownside:economics.downside,
      liquidityStatus:'ASSESSED',
      riskStatus:'ASSESSED',
      invalidationConditions:research.invalidationConditions,
      expiresAt:input.policy.opportunityExpiresAt,
    })
    tradeMims=makeTradeMims({research,opportunity,evidence:fusionEvidence,market:input.market,policy:input.policy,calibrationSampleSize:input.calibrationSampleSize})
    const liquidityScore=liquidityBps(input.market.liquidityUsd,input.policy.minLiquidityUsd)
    const maxByLiquidity=BigInt(Math.floor(input.market.liquidityUsd*100))*BigInt(input.policy.maxLiquidityParticipationBps)/10000n
    if(maxByLiquidity<input.policy.minimumCapitalMinor){
      reasons.push('MONEY_LIQUIDITY_CAP_BELOW_MINIMUM_CAPITAL')
    }else{
      validation=Object.freeze({
        validationId:'money-shark-validation:'+hash({opportunityId:opportunity.opportunityId,market:input.market.evidenceId,policy:input.policy.policyId}),
        sourceAssessmentId:research.sourceAssessmentId,
        moneyOpportunityId:opportunity.opportunityId,
        strategyId:input.policy.strategyId,
        instrumentId,
        evidenceQualityBps:eq,
        liquidityBps:liquidityScore,
        minimumCapitalMinor:input.policy.minimumCapitalMinor,
        maximumCapitalMinor:maxByLiquidity,
        observedAt:input.market.observedAt,
        availableAt:cutoff,
        expiresAt:input.policy.opportunityExpiresAt,
        correlationGroupIds:Object.freeze(['meme:'+research.chainId,'token:'+research.tokenAddress]),
        evidenceIds:unique([...fusionEvidence.map(e=>e.evidenceId),input.market.evidenceId]),
        authority:'MONEY_VALIDATION_ONLY',
        canExecute:false,
      })
    }
  }

  const disposition=reasons.some(x=>x==='MONEY_LIQUIDITY_BELOW_RUNTIME_FLOOR'||x==='MONEY_LIQUIDITY_CAP_BELOW_MINIMUM_CAPITAL'||x==='MONEY_DIALECTIC_NOT_SUPPORTED')?'BLOCKED':opportunity&&tradeMims&&validation?'MONEY_OPPORTUNITY_READY':'RESEARCH_ONLY'
  return Object.freeze({
    runtimeVersion:SHARK_COFFER_RUNTIME_VERSION,
    sourceEnvelopeId:input.envelope.envelopeId,
    sourceAssessmentId:research.sourceAssessmentId,
    instrumentId,
    research,
    fusionEvidence,
    thesis,
    dialectic,
    ...(opportunity?{opportunity}:{}),
    ...(tradeMims?{tradeMims}:{}),
    ...(validation?{validation}:{}),
    disposition,
    reasonCodes:Object.freeze([...new Set(reasons)].sort()),
    informationCutoff:cutoff,
    evidenceIds:unique([...fusionEvidence.map(e=>e.evidenceId),input.market.evidenceId,thesis.thesisId,dialectic.assessmentId]),
    authority:'MONEY_RESEARCH_ONLY',
    canExecute:false,
  })
}
