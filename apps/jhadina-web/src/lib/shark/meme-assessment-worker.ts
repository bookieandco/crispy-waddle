import type {SupabaseClient} from '@supabase/supabase-js'
import type {
  MemeTradeAssessment,
} from '@jhadina/shark-intelligence-core/meme-trader'
import {
  createPersistedActorAwareMemeTradeAssessment,
  type PersistedActorAwareAssessmentInput,
} from './actor-aware-assessment-service'
import {
  createSharkMoneyResearchEnvelope,
  type SharkMoneyEvidenceMetadata,
} from './money-research-bridge'
import {
  appendMemeTradeAssessmentEvidence,
  type SharkResearchAppendDisposition,
} from './research-evidence-repository'

export type MemeAssessmentCycleResult=Readonly<{
  assessment:MemeTradeAssessment
  envelope:ReturnType<typeof createSharkMoneyResearchEnvelope>
  persistence:SharkResearchAppendDisposition
  authority:'INTELLIGENCE_ONLY'
  canAuthorizeTrade:false
}>

type Overrides=Readonly<{
  createAssessment?:(client:SupabaseClient,input:PersistedActorAwareAssessmentInput)=>Promise<MemeTradeAssessment>
  createEnvelope?:typeof createSharkMoneyResearchEnvelope
  persistAssessment?:typeof appendMemeTradeAssessmentEvidence
}>

/**
 * Canonical app-level SHARK assessment composition.
 *
 * One persisted actor-aware assessment is the source for both the durable
 * research record and the SHARK -> Money envelope. No duplicate scoring path
 * and no financial authority are introduced here.
 */
export async function runMemeAssessmentCycle(
  input:Readonly<{
    client:SupabaseClient
    assessment:PersistedActorAwareAssessmentInput
    contextId:string
    evidence:readonly SharkMoneyEvidenceMetadata[]
    source:string
  }>,
  overrides:Overrides={},
):Promise<MemeAssessmentCycleResult>{
  if(!input.contextId.trim()||!input.source.trim())throw new Error('SHARK_MEME_ASSESSMENT_CYCLE_IDENTITY_REQUIRED')
  const createAssessment=overrides.createAssessment??createPersistedActorAwareMemeTradeAssessment
  const createEnvelope=overrides.createEnvelope??createSharkMoneyResearchEnvelope
  const persistAssessment=overrides.persistAssessment??appendMemeTradeAssessmentEvidence

  const assessment=await createAssessment(input.client,input.assessment)
  const envelope=createEnvelope({
    assessment,
    contextId:input.contextId,
    evidence:input.evidence,
  })
  const persistence=await persistAssessment(input.client,{
    assessment,
    informationCutoff:envelope.assessment.informationCutoff,
    source:input.source,
  })
  return Object.freeze({
    assessment,
    envelope,
    persistence,
    authority:'INTELLIGENCE_ONLY',
    canAuthorizeTrade:false,
  })
}
