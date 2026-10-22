/** SHARK-PILOT.35–.37: owner-private, offline acceptance panel contract.
 * No network, persistence, Telegram API, wallet or background tasks.
 */
import type {CommissionAcceptance,CommissionPaperReview} from './shark-commission-27-32'
export type PilotRecoveryEvidence=Readonly<{
  localLedgerIntegrityVerified:boolean
  sameHeadRestoreVerified:boolean
  encryptedOffHostRestoreVerified:boolean
  failureRecoveryReplayedWithoutDuplication:boolean
  ownerPhoneReadbackVerified:boolean
  providerTimeoutTestPassed:boolean
  evidenceIds:readonly string[]
}>
export type SharkPrivatePilotPanel=Readonly<{
  scope:'OWNER_PRIVATE_RESEARCH_PREVIEW'
  status:'OFFLINE_ACCEPTANCE_BLOCKED'|'ELIGIBLE_FOR_OWNER_DEVICE_TEST'
  checkedMints:number
  prospectiveCases?:number
  missedPriceOnlyRunners?:number
  blockers:readonly string[]
  confirmedDeviceDelivery:false
  verifiedProfit:false
  canTrade:false
  canSpend:false
  canSign:false
  canDeploy:false
}>
export function renderSharkPrivatePilotStatus(input:{
 acceptance:CommissionAcceptance
 paper?:CommissionPaperReview
 recovery?:PilotRecoveryEvidence
}):SharkPrivatePilotPanel{
 const b=[...input.acceptance.blockers]
 if(!input.recovery)b.push('recovery-evidence-not-provided')
 else{
  if(!input.recovery.evidenceIds.length||input.recovery.evidenceIds.some(x=>!x.trim()))
    b.push('recovery-proof-identifiers-missing')
  if(!input.recovery.localLedgerIntegrityVerified)b.push('local-ledger-integrity-not-verified')
  if(!input.recovery.sameHeadRestoreVerified)b.push('same-head-restore-not-verified')
  if(!input.recovery.encryptedOffHostRestoreVerified)b.push('encrypted-offhost-restore-not-verified')
  if(!input.recovery.failureRecoveryReplayedWithoutDuplication)b.push('idempotent-recovery-not-verified')
  if(!input.recovery.ownerPhoneReadbackVerified)b.push('owner-phone-readback-not-verified')
  if(!input.recovery.providerTimeoutTestPassed)b.push('provider-outage-test-not-verified')
 }
 if(!input.paper)b.push('prospective-paper-review-missing')
 return Object.freeze({
  scope:'OWNER_PRIVATE_RESEARCH_PREVIEW',
  status:b.length?'OFFLINE_ACCEPTANCE_BLOCKED':'ELIGIBLE_FOR_OWNER_DEVICE_TEST',
  checkedMints:input.acceptance.observedMints,
  prospectiveCases:input.paper?.prospectiveLaunches,
  missedPriceOnlyRunners:input.paper?.missedMarked2x,
  blockers:Object.freeze([...new Set(b)].sort()),
  confirmedDeviceDelivery:false,verifiedProfit:false,
  canTrade:false,canSpend:false,canSign:false,canDeploy:false,
 })
}
