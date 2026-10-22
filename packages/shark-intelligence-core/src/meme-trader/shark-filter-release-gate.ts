/**
 * Deterministic, non-self-promoting release review. Human authorization and
 * external provider commissioning are NEVER granted by this function.
 */
export type SharkFilterAcceptanceEvidence=Readonly<{
  repositoryHead:string
  evaluatedHead:string
  githubCIPassed:boolean
  independentFeeDefinitionVerified:boolean
  providerReadOnlyCanaryVerified:boolean
  independentlySourcedSafetyChecksVerified:boolean
  historicalReplayPassed:boolean
  heldOutProspectiveLabelsPresent:boolean
  missedRunnerAuditPassed:boolean
  quoteSellabilityProven:boolean
  exitCostCoverageVerified:boolean
  actualEndToEndLatencyObserved:boolean
  persistentHostRecoveryTestPassed:boolean
  privateAlertDeliveryVerified:boolean
  moneyCoreReviewCompleted:boolean
  evidenceIds:readonly string[]
}>
export type SharkFilterReviewGate=Readonly<{
  disposition:'BLOCKED_EVIDENCE'|'ELIGIBLE_FOR_OWNER_REVIEW'
  blockers:readonly string[]
  evidenceIds:readonly string[]
  authority:'REVIEW_ONLY'
  activated:false
  signerPermitted:false
  spendingPermitted:false
}>
export function evaluateSharkFilterReviewGate(input:SharkFilterAcceptanceEvidence):SharkFilterReviewGate{
  const blockers:string[]=[]
  if(!input.repositoryHead.trim()||!input.evaluatedHead.trim()||
     input.repositoryHead!==input.evaluatedHead)blockers.push('exact-head-not-matched')
  const requirements={
    githubCIPassed:'exact-head-ci-not-passed',
    independentFeeDefinitionVerified:'fee-metric-definition-unverified',
    providerReadOnlyCanaryVerified:'real-read-only-source-not-commissioned',
    independentlySourcedSafetyChecksVerified:'rug-and-sellability-coverage-not-proven',
    historicalReplayPassed:'replay-not-passed',
    heldOutProspectiveLabelsPresent:'prospective-holdout-not-labeled',
    missedRunnerAuditPassed:'missed-runner-audit-not-passed',
    quoteSellabilityProven:'exit-quote-sellability-not-proven',
    exitCostCoverageVerified:'exit-costs-not-covered',
    actualEndToEndLatencyObserved:'actual-event-to-exit-not-measured',
    persistentHostRecoveryTestPassed:'host-recovery-not-certified',
    privateAlertDeliveryVerified:'private-delivery-not-certified',
    moneyCoreReviewCompleted:'money-core-review-pending',
  } as const
  for(const [key,reason] of Object.entries(requirements)){
    if(input[key as keyof typeof requirements]!==true)blockers.push(reason)
  }
  if(input.evidenceIds.length===0||input.evidenceIds.some(id=>!id.trim()))
    blockers.push('evidence-ids-missing')
  return Object.freeze({
    disposition:blockers.length?'BLOCKED_EVIDENCE':'ELIGIBLE_FOR_OWNER_REVIEW',
    blockers:Object.freeze(blockers),evidenceIds:Object.freeze([...new Set(input.evidenceIds)].sort()),
    authority:'REVIEW_ONLY',activated:false,signerPermitted:false,spendingPermitted:false,
  })
}
