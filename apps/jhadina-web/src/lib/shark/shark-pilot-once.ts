import {
  readPublicDexPair,runPublicFilterCanary,
  type VerifiedStageReceipt,type TerminalFeeSnapshot,
  type SharkDiscoveryPresetId,
} from '@jhadina/shark-intelligence-core/meme-trader'
import {runScreenedMemeResearchCycle} from './screened-meme-research-cycle'
import {runMemeAssessmentCycle} from './meme-assessment-worker'

/**
 * SHARK-PILOT.34: bounded, manually invoked bridge. Does NOT run a scheduled
 * listener, open a wallet, read Telegram inboxes or persist any new system.
 * The existing Python public collector can pass its observed mint/pair here,
 * but this bridge does not import its SQLite state or claim to observe it live.
 */
export async function runSharkPublicPilotOnce(input:Readonly<{
  mint:string
  originalPairAddress:string
  availableAt:string
  sourceReceiptId:string
  presetId:SharkDiscoveryPresetId
  stage?:VerifiedStageReceipt
  terminalFee?:TerminalFeeSnapshot
  /** Canonical SHARK -> Money research request, not an order. */
  cycle:Parameters<typeof runMemeAssessmentCycle>[0]
}>,deps:Readonly<{
  fetcher:Parameters<typeof readPublicDexPair>[0]['fetcher']
  executeCycle?:typeof runMemeAssessmentCycle
}>){
  if(input.cycle.assessment.market.chainId!=='solana'||
     input.cycle.assessment.market.subjectId!==input.mint)
    throw new Error('shark_pilot_canonical_mint_mismatch')
  const received=await readPublicDexPair({
    mint:input.mint,pairAddress:input.originalPairAddress,
    receivedAt:input.availableAt,localReceiptId:input.sourceReceiptId,
    fetcher:deps.fetcher,
  })
  const canary=runPublicFilterCanary({
    read:received,stage:input.stage,feeSnapshot:input.terminalFee,
    presetId:input.presetId,informationCutoff:input.availableAt,
  })
  if(canary.status!=='SCREENED_RESEARCH_ONLY'||!canary.screen||
     canary.screen.disposition!=='MATCH'){
    return Object.freeze({
      canary,assessmentInvoked:false as const,
      reason:canary.screen?.disposition??canary.status,
      canSign:false as const,canSpend:false as const,canTrade:false as const,
    })
  }
  // Rebuild from validated read-only source data and canonical-stage evidence;
  // avoid invoking the existing cycle with a caller-supplied unreviewed screen.
  const pair=canary.pair!
  const stage= input.stage!
  const observation={
    chainId:'solana' as const,mint:pair.mint,
    stage:stage.stage,protocol:pair.dexId,
    observedAt:pair.receivedAt,availableAt:pair.receivedAt,
    evaluatedAsOf:input.availableAt,
    ageMinutes:pair.pairCreatedAt===undefined?undefined:
      (Date.parse(pair.receivedAt)-pair.pairCreatedAt)/60000,
    volumeUsd:pair.hourlyVolumeUsd,marketCapUsd:pair.marketCapUsd,
    socialLinksCount:pair.socialLinksCount,
    fee:canary.screen.passedRules.includes('feePaidSol')&&input.terminalFee?
      {kind:input.terminalFee.metricName,unit:'SOL' as const,
        amount:input.terminalFee.amount,venue:input.terminalFee.terminal,
        observedAt:input.terminalFee.observedAt,evidenceId:input.terminalFee.evidenceId}:undefined,
    evidenceIds:canary.screen.evidenceIds,
    defensiveBlockReasons:stage.defensiveBlockReasons,
  }
  const result=await runScreenedMemeResearchCycle({
    discovery:observation,presetId:input.presetId,cycle:input.cycle,
  },{executeCycle:deps.executeCycle})
  return Object.freeze({
    canary,assessmentInvoked:result.persisted,
    candidate:result.candidate,
    canSign:false as const,canSpend:false as const,canTrade:false as const,
  })
}
