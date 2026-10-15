import {
  assessMemeWalletPaperCandidate,
  createMemeWalletPaperReceipt,
  type MemeWalletCandidate,
  type MemeWalletPaperDecision,
  type MemeWalletPaperPolicy,
  type MemeWalletPaperReceipt,
  type MemeWalletPaperState,
  type MemeWalletResearchIdentity,
} from './meme-wallet-paper-gate.js'

/**
 * MEME-WALLET paper-only orchestrator.
 * An authorized SHARK research consumer supplies provenance-backed candidates;
 * this component never searches the chain, signs, quotes, or calls a DEX.
 * The journal interface must be backed by an append-only, durable store before
 * any unattended paper experiment is described as deployed.
 */
export interface MemeWalletPaperJournal {
  getByCase(walletId:string,caseId:string):Promise<Readonly<{
    decision:MemeWalletPaperDecision
    receipt:MemeWalletPaperReceipt|null
  }> | null>
  appendDecision(decision:MemeWalletPaperDecision):Promise<void>
  appendReceipt(receipt:MemeWalletPaperReceipt):Promise<void>
}
export type MemePaperProposalResult=Readonly<{
  decision:MemeWalletPaperDecision
  recoveredExisting:boolean
  journaled:boolean
  authority:'PAPER_JOURNAL_ONLY'
  canExecute:false
}>
export async function submitMemeWalletPaperProposal(input:Readonly<{
  wallet:MemeWalletResearchIdentity
  policy:MemeWalletPaperPolicy
  candidate:MemeWalletCandidate
  state:MemeWalletPaperState
  entryMinor:bigint
  now:string
  journal:MemeWalletPaperJournal
}>):Promise<MemePaperProposalResult>{
  const existing=await input.journal.getByCase(input.wallet.walletId,input.candidate.caseId)
  if(existing){
    // A candidate must not be replayed to accumulate extra simulated fills.
    return Object.freeze({
      decision:existing.decision,recoveredExisting:true,journaled:true,
      authority:'PAPER_JOURNAL_ONLY',canExecute:false,
    })
  }
  const decision=assessMemeWalletPaperCandidate(input)
  // No implicit fill; a separate, explicitly timestamped simulator supplies
  // outcome evidence. Admitted decisions without outcomes remain unresolved.
  await input.journal.appendDecision(decision)
  const stored=await input.journal.getByCase(input.wallet.walletId,input.candidate.caseId)
  if(!stored || stored.decision.decisionId!==decision.decisionId ||
      stored.decision.walletId!==decision.walletId ||
      stored.decision.candidateCaseId!==decision.candidateCaseId ||
      stored.decision.proposedEntryMinor!==decision.proposedEntryMinor ||
      stored.decision.disposition!==decision.disposition ||
      stored.decision.canExecute!==false || stored.decision.canMoveMoney!==false ||
      stored.decision.canSign!==false) {
    throw new Error('MEME_WALLET_PAPER_DECISION_READBACK_MISMATCH')
  }
  return Object.freeze({
    decision,recoveredExisting:false,journaled:true,
    authority:'PAPER_JOURNAL_ONLY',canExecute:false,
  })
}
export async function recordMemeWalletPaperSettlement(input:Readonly<{
  journal:MemeWalletPaperJournal
  walletId:string
  candidateCaseId:string
  state:'PAPER_FILLED'|'PAPER_FAILED'|'PAPER_UNKNOWN'
  outputAtomic:string|null
  simulatedFeeMinor:bigint
  observedAt:string
  evidenceIds:readonly string[]
}>){
  const record=await input.journal.getByCase(input.walletId,input.candidateCaseId)
  if(!record)throw Error('MEME_WALLET_PAPER_PROPOSAL_NOT_FOUND')
  if(record.receipt)throw Error('MEME_WALLET_PAPER_SETTLEMENT_ALREADY_RECORDED')
  const receipt=createMemeWalletPaperReceipt({
    decision:record.decision,state:input.state,outputAtomic:input.outputAtomic,
    simulatedFeeMinor:input.simulatedFeeMinor,observedAt:input.observedAt,
    evidenceIds:input.evidenceIds,
  })
  await input.journal.appendReceipt(receipt)
  const stored=await input.journal.getByCase(input.walletId,input.candidateCaseId)
  if(!stored?.receipt ||
      stored.receipt.decisionId!==receipt.decisionId ||
      stored.receipt.state!==receipt.state ||
      stored.receipt.inputMinor!==receipt.inputMinor ||
      stored.receipt.simulatedFeeMinor!==receipt.simulatedFeeMinor ||
      stored.receipt.outputAtomic!==receipt.outputAtomic ||
      stored.receipt.canExecute!==false) {
    throw new Error('MEME_WALLET_PAPER_SETTLEMENT_READBACK_MISMATCH')
  }
  return receipt
}
