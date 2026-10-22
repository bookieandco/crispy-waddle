import {
  evaluateSharkDiscoveryScreen,
  composeScreenedSharkCandidate,
  type SharkDiscoveryObservation,
  type SharkDiscoveryPresetId,
} from '@jhadina/shark-intelligence-core/meme-trader'
import {runMemeAssessmentCycle} from './meme-assessment-worker'

/**
 * Explicit, opt-in application entrypoint for SHARK-FILTER. Never supplants
 * the persisted actor-aware SHARK -> Money research cycle.
 *
 * SKIP, BLOCKED and REVIEW make zero persistence or service calls.
 * MATCH invokes the canonical intelligence-only assessment exactly once.
 * Live trading, signing and money allocations do not exist on this path.
 */
export async function runScreenedMemeResearchCycle(
  input:Readonly<{
    discovery:SharkDiscoveryObservation
    presetId:SharkDiscoveryPresetId
    cycle:Parameters<typeof runMemeAssessmentCycle>[0]
  }>,
  overrides:Readonly<{
    executeCycle?:typeof runMemeAssessmentCycle
  }>={},
){
  if(input.cycle.assessment.market.chainId!=='solana'||
     input.cycle.assessment.market.subjectId!==input.discovery.mint)
    throw new Error('SHARK_SCREENED_APP_ASSET_MISMATCH')
  const screen=evaluateSharkDiscoveryScreen(input.discovery,input.presetId)
  const cutoff=input.discovery.evaluatedAsOf??input.discovery.availableAt
  if(screen.disposition!=='MATCH'){
    return Object.freeze({
      screen,
      candidate:composeScreenedSharkCandidate({screen,informationCutoff:cutoff}),
      persisted:false as const,authority:'INTELLIGENCE_ONLY' as const,
      canAuthorizeTrade:false as const,
    })
  }
  const execute=overrides.executeCycle??runMemeAssessmentCycle
  const result=await execute(input.cycle)
  const candidate=composeScreenedSharkCandidate({
    screen,assessment:result.assessment,
    assessmentAvailableAt:result.assessment.assessedAt,
    informationCutoff:result.assessment.assessedAt,
  })
  return Object.freeze({
    screen,candidate,persisted:true as const,
    assessmentCycle:result,authority:'INTELLIGENCE_ONLY' as const,
    canAuthorizeTrade:false as const,
  })
}
