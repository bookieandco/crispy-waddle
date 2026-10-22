import type {ScreenedSharkCandidate} from './screened-shark-candidate'
import type {LiveFilterProspectiveCase} from './shark-filter-live-paper'
import {estimateSharkShadowRoundTrip,
  type QuoteCostEvidence,type SharkShadowRoundTrip} from './shark-filter-execution-research'

export type LiveFilterRouteCoverage=Readonly<{
  quoteProvider:string
  entryEvidenceId:string
  exitEvidenceId:string
  entryPairAddress:string
  exitPairAddress:string
  allFeeFamiliesChecked:boolean
  taxAndTransferExtensionChecked:boolean
  routeSellabilityIndependentlyVerified:boolean
}>
export type LiveFilterPaperReview=Readonly<{
  caseId:string
  status:'NO_FILL_OR_UNVERIFIED'|'READ_ONLY_SHADOW_ESTIMATE'
  reasons:readonly string[]
  shadow:SharkShadowRoundTrip
  evidenceIds:readonly string[]
  authority:'MONEY_PAPER_REVIEW_REQUIRED'
  moneyCorePaperFill:false
  realFill:false
  signerPermitted:false
}>

/**
 * Canonical SHARK assessment and original pair identity must be retained.
 * Quote presence never turns into a simulated executed order.
 */
export function reviewLiveFilterPaperRoute(input:{
  study:LiveFilterProspectiveCase
  candidate?:ScreenedSharkCandidate
  coverage?:LiveFilterRouteCoverage
  entry?:QuoteCostEvidence
  exit?:QuoteCostEvidence
  evaluatedAt:string
}):LiveFilterPaperReview{
  const {study,candidate,coverage}=input
  if(candidate&&(candidate.screen.mint!==study.mint||candidate.canAuthorizeTrade!==false))
    throw new Error('shark_live_route_candidate_binding_invalid')
  const shadow=estimateSharkShadowRoundTrip({
    mint:study.mint,decisionAt:study.sealedAt,evaluatedAt:input.evaluatedAt,
    entry:input.entry,exit:input.exit,
  })
  const reasons:string[]=[]
  if(!candidate||candidate.disposition!=='WATCH_RESEARCH_ONLY')
    reasons.push('canonical-risk-review-incomplete')
  if(!coverage||!coverage.quoteProvider.trim()||!coverage.entryEvidenceId.trim()||
     !coverage.exitEvidenceId.trim()||coverage.entryPairAddress!==study.originalPairAddress||
     coverage.exitPairAddress!==study.originalPairAddress)
    reasons.push('original-pair-route-provenance-incomplete')
  if(!coverage?.allFeeFamiliesChecked)reasons.push('fees-and-priority-costs-unverified')
  if(!coverage?.taxAndTransferExtensionChecked)reasons.push('token-transfer-controls-unverified')
  if(!coverage?.routeSellabilityIndependentlyVerified)reasons.push('actual-sellability-unverified')
  if(input.entry&&coverage&&!input.entry.evidenceIds.includes(coverage.entryEvidenceId))
    reasons.push('entry-route-evidence-unbound')
  if(input.exit&&coverage&&!input.exit.evidenceIds.includes(coverage.exitEvidenceId))
    reasons.push('exit-route-evidence-unbound')
  if(shadow.state==='NO_FILL')reasons.push(...shadow.blockers)
  const status=reasons.length?'NO_FILL_OR_UNVERIFIED':'READ_ONLY_SHADOW_ESTIMATE'
  // Do not expose even an indicative net return while fundamental coverage is
  // missing. The original quotes can still be audited via evidence IDs.
  const guardedShadow:SharkShadowRoundTrip=status==='NO_FILL_OR_UNVERIFIED'?
    Object.freeze({
      state:'NO_FILL' as const,
      entryQuoteId:shadow.entryQuoteId,exitQuoteId:shadow.exitQuoteId,
      blockers:Object.freeze([...new Set(reasons)].sort()),
      evidenceIds:shadow.evidenceIds,
      authority:'SHADOW_ESTIMATE_NOT_REALIZED_PNL' as const,
      canAuthorizeTrade:false as const,
    }):shadow
  return Object.freeze({
    caseId:study.caseId,status,reasons:Object.freeze([...new Set(reasons)].sort()),
    shadow:guardedShadow,evidenceIds:Object.freeze([...new Set([
      study.originalMarketReceiptId,...shadow.evidenceIds,
      ...(candidate?.evidenceIds??[]),
    ])].sort()),
    authority:'MONEY_PAPER_REVIEW_REQUIRED',
    moneyCorePaperFill:false,realFill:false,signerPermitted:false,
  })
}
