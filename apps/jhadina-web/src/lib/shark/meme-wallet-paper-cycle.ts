import type { MemeTradeAssessment } from '@jhadina/shark-intelligence-core/meme-trader'
import {
  bindOwnerCreatedMemeWallet,
  submitMemeWalletPaperProposal,
  type MemeWalletPaperJournal,type MemeWalletPaperPolicy,
  type MemeWalletPaperState,type MemePaperProposalResult,
} from '@jhadina/money-core'
import {
  mapSharkAssessmentToMemePaper,
  type MemePaperSafetyReceipt,type MemePaperQuoteEvidence,
} from './meme-wallet-paper-adapter'

/**
 * Canonical persisted SHARK assessment -> gated paper proposal.
 * Caller MUST pass the exact assessment already persisted by the SHARK
 * research worker, plus independent quote and chain safety receipts.
 * No market fetching, signing, broadcasting, or wallet credentials occur.
 */
export async function runMemeWalletPaperFromSharkAssessment(input:Readonly<{
  assessment:MemeTradeAssessment
  persistedAssessmentId:string
  walletAddress:string
  registeredOwnerWallets:readonly string[]
  cofferWallets:readonly string[]
  phantomMcpWallets:readonly string[]
  quote:MemePaperQuoteEvidence
  safety:readonly MemePaperSafetyReceipt[]
  policy:MemeWalletPaperPolicy
  state:MemeWalletPaperState
  proposedPaperEntryMinor:bigint
  informationCutoff:string
  maxEvidenceAgeMs:number
  journal:MemeWalletPaperJournal
}>):Promise<MemePaperProposalResult>{
  if(input.persistedAssessmentId!==input.assessment.assessmentId)
    throw Error('MEME_WALLET_SHARK_PERSISTED_ASSESSMENT_REQUIRED')
  const wallet=bindOwnerCreatedMemeWallet({
    solanaAddress:input.walletAddress,
    ownerWalletAddresses:input.registeredOwnerWallets,
    cofferWalletAddresses:input.cofferWallets,
    mcpAgentAddresses:input.phantomMcpWallets,
  })
  const candidate=mapSharkAssessmentToMemePaper({
    assessment:input.assessment,strategyId:'JHADINA_SHARK_SNIPER_PAPER_V1',
    quote:input.quote,safety:input.safety,
    cutoff:input.informationCutoff,maxEvidenceAgeMs:input.maxEvidenceAgeMs,
  })
  return submitMemeWalletPaperProposal({
    wallet,policy:input.policy,candidate,state:input.state,
    entryMinor:input.proposedPaperEntryMinor,now:input.informationCutoff,
    journal:input.journal,
  })
}
