import type { MemeResearchComparison, MemeResearchScorecard } from './meme-paper-learning.js'
import type { MemeStorageReadiness } from './meme-storage-readiness.js'
import type { PaperExitCase } from './meme-paper-exit.js'

/** MEME-PROFIT.15–.18 evidence gate. This does NOT commission trading. */
export type MemeProfitFinalEvidence = {
  exactCommit: string
  allRequiredCiPassed: boolean
  webBuildPassed: boolean
  modelTestsPassed: boolean
  crossOwnerTestsPassed: boolean
  modelScoring: readonly MemeResearchScorecard[]
  comparison: MemeResearchComparison
  storage: MemeStorageReadiness
  exitDryRun: PaperExitCase
  actualDistinctObservationDates: number
  liveMarketDataProvenanceVerified: boolean
  ownerApprovedRiskLimits: boolean
  independentLegalReviewCompleted: boolean
  independentSecurityReviewCompleted: boolean
  productionAuthenticatedCrudReceipt: boolean
}
export type MemeProfitFinalOutcome = {
  paperSoftware: 'PASS' | 'INCOMPLETE'
  realSevenDayResearch: 'PASS' | 'INCOMPLETE'
  storageCommissioning: 'PASS' | 'BLOCKED'
  commercialAcceptance: 'NOT_PROVEN'
  operationalMoneyAuthority: false
  liveTokenOperations: 'DISABLED'
  missingEvidence: readonly string[]
  commit: string
}
export function evaluateMemeProfitFinalEvidence(e: MemeProfitFinalEvidence): MemeProfitFinalOutcome {
  if (!/^[a-f0-9]{40}$/.test(e.exactCommit)) throw Error('MEME_PROFIT_COMMIT_EVIDENCE_INVALID')
  const missing: string[]=[]
  const add=(ok:boolean,msg:string)=>{if(!ok)missing.push(msg)}
  add(e.allRequiredCiPassed,'Full exact-head CI is not green')
  add(e.webBuildPassed,'Web production build is not verified')
  add(e.modelTestsPassed,'Model regression tests are not verified')
  add(e.crossOwnerTestsPassed,'Cross-owner access tests are not verified')
  add(e.modelScoring.length>0 && e.modelScoring.every(c=>
    c.mode==='PAPER_ONLY' && c.actualTrades===0 && c.actualEarningsUsd===0 &&
    !c.autopilotAuthorized && c.observations.length===7), 'Paper scorecard proof missing')
  add(e.comparison.mode==='PAPER_ONLY' && e.comparison.winnerForLiveTrading===null &&
      e.comparison.actualEarningsUsd===0,'Paper comparison attempted to claim live trading')
  add(e.exitDryRun.protectedLiquidity===true &&
      e.exitDryRun.walletActionsEnabled===false &&
      e.exitDryRun.tokenSaleAuthorized===false &&
      e.exitDryRun.custodyMovementAuthorized===false &&
      e.exitDryRun.status==='CLOSED_PAPER','Safe exit paper-dry-run incomplete')
  const paperComplete=missing.length===0
  const realWeek=e.actualDistinctObservationDates>=7 &&
    e.liveMarketDataProvenanceVerified===true &&
    e.modelScoring.length>0 &&
    e.modelScoring.every(c=>c.sourceClass==='UNVERIFIED_READ_ONLY_RESEARCH')
  add(realWeek,'Seven distinct observed days with independently verified source receipts not proven')
  const db=e.storage.status==='READY_FOR_PAPER_ONLY' && e.productionAuthenticatedCrudReceipt
  add(db,'Canonical Supabase owner-scoped storage not commissioned')
  add(e.ownerApprovedRiskLimits,'Owner-approved paper risk limits not recorded')
  add(e.independentLegalReviewCompleted,'Independent legal review not completed')
  add(e.independentSecurityReviewCompleted,'Independent security review not completed')
  return {
    paperSoftware:paperComplete?'PASS':'INCOMPLETE',
    realSevenDayResearch:realWeek?'PASS':'INCOMPLETE',
    storageCommissioning:db?'PASS':'BLOCKED',
    commercialAcceptance:'NOT_PROVEN',
    operationalMoneyAuthority:false,
    liveTokenOperations:'DISABLED',
    missingEvidence:missing,
    commit:e.exactCommit,
  }
}
