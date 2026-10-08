import type {PersistedActorAwareAssessmentInput} from './actor-aware-assessment-service'
import type {SharkMoneyEvidenceMetadata} from './money-research-bridge'

export type ScheduledMemeAssessmentSubmission=Readonly<{
  userId:string
  contextId:string
  source:string
  assessment:PersistedActorAwareAssessmentInput
  evidence:readonly SharkMoneyEvidenceMetadata[]
}>

const isRecord=(value:unknown):value is Record<string,unknown>=>
  typeof value==='object' && value!==null && !Array.isArray(value)
const nonempty=(value:unknown,max=256):value is string=>
  typeof value==='string' && value.trim().length>0 && value.length<=max
const millis=(value:unknown):number=>
  typeof value==='string' && value.trim()?Date.parse(value):NaN

/**
 * Admission for a scheduler-authenticated, fully assembled SHARK research
 * input. This intentionally does NOT manufacture actor/rug/market evidence
 * from a Pump launch or grant trade authority. Every submission still passes
 * the canonical persisted actor and Money research-only validations.
 */
export function validateScheduledMemeAssessment(
  value:unknown,
  now:string,
):ScheduledMemeAssessmentSubmission {
  const at=millis(now)
  if(!Number.isFinite(at))throw new Error('SHARK_MEME_DISPATCH_CLOCK_INVALID')
  if(!isRecord(value)
    || !nonempty(value.userId,128)
    || !nonempty(value.contextId,256)
    || !nonempty(value.source,128)
    || !isRecord(value.assessment))throw new Error('SHARK_MEME_DISPATCH_IDENTITY_REQUIRED')

  const assessment=value.assessment
  const market=assessment.market
  if(!isRecord(market)
    || market.chainId!=='solana-mainnet'
    || !nonempty(market.subjectId,128)
    || !nonempty(market.observationId,256)
    || !nonempty(market.source,128)
    || !isRecord(market.payload))
    throw new Error('SHARK_MEME_DISPATCH_MARKET_REQUIRED')

  const observed=millis(market.observedAt)
  const received=millis(market.receivedAt)
  // Pricing evidence older than five minutes is NOT admitted as current
  // sniper/meme research, even if the launch itself is old.
  if(!Number.isFinite(observed)||!Number.isFinite(received)
    || observed>received||received>at||at-received>300_000)
    throw new Error('SHARK_MEME_DISPATCH_MARKET_STALE_OR_FUTURE')

  if(!Array.isArray(value.evidence)||value.evidence.length===0||value.evidence.length>64)
    throw new Error('SHARK_MEME_DISPATCH_EVIDENCE_REQUIRED')
  const seen=new Set<string>()
  for(const item of value.evidence){
    if(!isRecord(item)||!nonempty(item.evidenceId,256)
      ||!nonempty(item.source,128)||!nonempty(item.sourceGroup,128)
      ||item.immutable!==true
      ||seen.has(item.evidenceId))
      throw new Error('SHARK_MEME_DISPATCH_PROVENANCE_INVALID')
    seen.add(item.evidenceId)
    const observedAt=millis(item.observedAt)
    const availableAt=millis(item.availableAt)
    if(!Number.isFinite(observedAt)||!Number.isFinite(availableAt)
      ||observedAt>availableAt||availableAt>at)
      throw new Error('SHARK_MEME_DISPATCH_EVIDENCE_TIME_INVALID')
  }
  return value as unknown as ScheduledMemeAssessmentSubmission
}
