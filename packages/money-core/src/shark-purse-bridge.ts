import {createHash} from 'node:crypto'
import {
  assertMakeItMakeSenseCannotAuthorize,
  type StagedMakeItMakeSenseVote,
} from '@jhadina/core-spine'
import {
  assertOpportunityBoundary,
  type OpportunityCandidateV2,
} from './cross-asset-fusion-contracts.js'
import {
  assertSharkMoneyResearchOnly,
  type SharkMoneyResearchArtifact,
} from './shark-intelligence-ingress.js'
import {
  assertPurseOpportunity,
  type PurseOpportunity,
  type PurseOpportunityGovernance,
} from './purse-opportunity-bus.js'

export type SharkPurseMoneyValidation=Readonly<{
  validationId:string
  sourceAssessmentId:string
  moneyOpportunityId:string
  strategyId:string
  instrumentId:string
  evidenceQualityBps:number
  liquidityBps:number
  minimumCapitalMinor:bigint
  maximumCapitalMinor:bigint
  observedAt:string
  availableAt:string
  expiresAt:string
  correlationGroupIds:readonly string[]
  evidenceIds:readonly string[]
  authority:'MONEY_VALIDATION_ONLY'
  canExecute:false
}>

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const unique=(values:readonly string[])=>Object.freeze([...new Set(values)].sort())
const bps=(value:number,code:string)=>{if(!Number.isInteger(value)||value<0||value>10000)throw new Error(code)}
const iso=(value:string,code:string)=>{if(!value||Number.isNaN(Date.parse(value)))throw new Error(code)}

function assertValidation(
  validation:SharkPurseMoneyValidation,
  research:SharkMoneyResearchArtifact,
  candidate:OpportunityCandidateV2,
):void{
  if(validation.authority!=='MONEY_VALIDATION_ONLY'||validation.canExecute!==false)throw new Error('MONEY_SHARK_PURSE_VALIDATION_AUTHORITY_INVALID')
  for(const [value,code] of [
    [validation.validationId,'MONEY_SHARK_PURSE_VALIDATION_ID_REQUIRED'],
    [validation.sourceAssessmentId,'MONEY_SHARK_PURSE_SOURCE_ASSESSMENT_REQUIRED'],
    [validation.moneyOpportunityId,'MONEY_SHARK_PURSE_MONEY_OPPORTUNITY_REQUIRED'],
    [validation.strategyId,'MONEY_SHARK_PURSE_STRATEGY_REQUIRED'],
    [validation.instrumentId,'MONEY_SHARK_PURSE_INSTRUMENT_REQUIRED'],
  ] as const)if(!value.trim())throw new Error(code)
  if(validation.sourceAssessmentId!==research.sourceAssessmentId)throw new Error('MONEY_SHARK_PURSE_SOURCE_ASSESSMENT_MISMATCH')
  if(validation.moneyOpportunityId!==candidate.opportunityId)throw new Error('MONEY_SHARK_PURSE_OPPORTUNITY_MISMATCH')
  if(!candidate.instrumentIds.includes(validation.instrumentId))throw new Error('MONEY_SHARK_PURSE_INSTRUMENT_MISMATCH')
  bps(validation.evidenceQualityBps,'MONEY_SHARK_PURSE_EVIDENCE_QUALITY_INVALID')
  bps(validation.liquidityBps,'MONEY_SHARK_PURSE_LIQUIDITY_INVALID')
  if(validation.minimumCapitalMinor<0n||validation.maximumCapitalMinor<=0n||validation.minimumCapitalMinor>validation.maximumCapitalMinor)throw new Error('MONEY_SHARK_PURSE_CAPITAL_RANGE_INVALID')
  for(const [value,code] of [
    [validation.observedAt,'MONEY_SHARK_PURSE_OBSERVED_AT_INVALID'],
    [validation.availableAt,'MONEY_SHARK_PURSE_AVAILABLE_AT_INVALID'],
    [validation.expiresAt,'MONEY_SHARK_PURSE_EXPIRES_AT_INVALID'],
  ] as const)iso(value,code)
  if(validation.availableAt<validation.observedAt||validation.expiresAt<=validation.availableAt)throw new Error('MONEY_SHARK_PURSE_VALIDATION_TIME_ORDER_INVALID')
  if(validation.availableAt<candidate.informationCutoff||validation.availableAt<research.informationCutoff)throw new Error('MONEY_SHARK_PURSE_VALIDATION_BEFORE_INFORMATION_CUTOFF')
  if(validation.expiresAt>candidate.expiresAt)throw new Error('MONEY_SHARK_PURSE_VALIDATION_OUTLIVES_OPPORTUNITY')
  if(!validation.evidenceIds.length)throw new Error('MONEY_SHARK_PURSE_VALIDATION_EVIDENCE_REQUIRED')
}

export function adaptSharkResearchToPurseOpportunity(input:Readonly<{
  research:SharkMoneyResearchArtifact
  candidate:OpportunityCandidateV2
  tradeMims:StagedMakeItMakeSenseVote<'TRADE'>
  validation:SharkPurseMoneyValidation
}>):PurseOpportunity{
  assertSharkMoneyResearchOnly(input.research)
  assertOpportunityBoundary(input.candidate)
  assertMakeItMakeSenseCannotAuthorize(input.tradeMims.vote)
  if(input.tradeMims.stage!=='TRADE'||input.tradeMims.authority!=='ADVISORY_ONLY'||input.tradeMims.canAuthorizeAction!==false)throw new Error('MONEY_SHARK_PURSE_MIMS_STAGE_INVALID')
  if(input.tradeMims.vote.subjectId!==input.candidate.opportunityId)throw new Error('MONEY_SHARK_PURSE_MIMS_SUBJECT_MISMATCH')
  if(input.candidate.subjectId!==input.research.subjectId)throw new Error('MONEY_SHARK_PURSE_SUBJECT_MISMATCH')
  if(input.candidate.assetClasses[0]!=='MEME'||input.candidate.direction!=='BULLISH')throw new Error('MONEY_SHARK_PURSE_MEME_LONG_ONLY')
  if(input.candidate.riskStatus!=='ASSESSED'||input.candidate.liquidityStatus!=='ASSESSED')throw new Error('MONEY_SHARK_PURSE_CANDIDATE_NOT_GOVERNED')
  if(input.candidate.informationCutoff<input.research.informationCutoff)throw new Error('MONEY_SHARK_PURSE_CANDIDATE_PRECEDES_RESEARCH')
  const lineagePrefix='fusion-evidence:shark:'+input.research.sourceAssessmentId+':'
  if(!input.candidate.evidenceIds.some(id=>id.startsWith(lineagePrefix)))throw new Error('MONEY_SHARK_PURSE_SOURCE_LINEAGE_MISSING')
  assertValidation(input.validation,input.research,input.candidate)

  const unresolvedContradictionCount=input.research.evidenceIntegrity.unresolvedContradictionIds.length
  const liveEligible=
    input.tradeMims.vote.status==='PASS'&&
    unresolvedContradictionCount===0&&
    input.candidate.riskStatus==='ASSESSED'&&
    input.candidate.liquidityStatus==='ASSESSED'&&
    input.candidate.expectedUpside>0

  const governance:PurseOpportunityGovernance=Object.freeze({
    mimsStage:'TRADE',
    mimsVoteId:input.tradeMims.vote.voteId,
    mimsStatus:input.tradeMims.vote.status,
    mimsReasonCodes:Object.freeze([...input.tradeMims.vote.reasonCodes]),
    sourceAssessmentId:input.research.sourceAssessmentId,
    moneyOpportunityId:input.candidate.opportunityId,
    unresolvedContradictionCount,
    liveEligible,
    evidenceIds:unique([
      input.tradeMims.vote.voteId,
      input.validation.validationId,
      ...input.validation.evidenceIds,
      ...input.research.evidence.map(e=>e.evidenceId),
    ]),
    authority:'GOVERNANCE_EVIDENCE_ONLY',
    canExecute:false,
  })

  const expectedNetEdgeBps=Math.round(input.candidate.expectedUpside*10000)
  const expectedDownsideBps=Math.round(Math.abs(input.candidate.expectedDownside)*10000)
  const confidenceBps=Math.round(input.candidate.confidence*10000)
  const provenanceHash=hash({
    sourceAssessmentId:input.research.sourceAssessmentId,
    moneyOpportunityId:input.candidate.opportunityId,
    tradeMimsVoteId:input.tradeMims.vote.voteId,
    tradeMimsStatus:input.tradeMims.vote.status,
    validationId:input.validation.validationId,
    strategyId:input.validation.strategyId,
    instrumentId:input.validation.instrumentId,
    expectedNetEdgeBps,
    expectedDownsideBps,
    confidenceBps,
    evidenceQualityBps:input.validation.evidenceQualityBps,
    liquidityBps:input.validation.liquidityBps,
    informationCutoff:input.candidate.informationCutoff,
  })

  const opportunity:PurseOpportunity=Object.freeze({
    opportunityId:'purse-shark:'+provenanceHash,
    sourceId:input.research.sourceAssessmentId,
    sourceKind:'SHARK',
    lane:'MEME',
    strategyId:input.validation.strategyId,
    instrumentId:input.validation.instrumentId,
    action:'ENTER',
    thesis:input.research.thesis,
    horizon:input.candidate.horizon,
    expectedNetEdgeBps,
    expectedDownsideBps,
    confidenceBps,
    evidenceQualityBps:input.validation.evidenceQualityBps,
    liquidityBps:input.validation.liquidityBps,
    minimumCapitalMinor:input.validation.minimumCapitalMinor,
    maximumCapitalMinor:input.validation.maximumCapitalMinor,
    correlationGroupIds:unique(input.validation.correlationGroupIds.length?input.validation.correlationGroupIds:['instrument:'+input.validation.instrumentId]),
    observedAt:input.validation.observedAt,
    availableAt:input.validation.availableAt,
    expiresAt:input.validation.expiresAt,
    evidenceIds:unique([
      ...input.candidate.evidenceIds,
      ...input.validation.evidenceIds,
      ...governance.evidenceIds,
    ]),
    provenanceHash,
    governance,
    authority:'INTELLIGENCE_ONLY',
    canExecute:false,
  })
  assertPurseOpportunity(opportunity)
  return opportunity
}
