import type {RecastReviewLedgerDecision} from './recast-review-ledger'
import type {RecastDurationDecision} from './recast-duration-evidence'
import type {RecastReviewedDecision} from './recast-reviewed-evidence'
import type {RecastPreviewWorkerHandoff} from './recast-preview-worker-handoff'

/** A metered preview requires a fresh, request-specific human decision
 * plus a separately certified ActionExecutor receipt at invocation time.
 * This interface never creates a signature or action token by itself. */
export interface RecastPreviewOwnerAuthorization {
  projectId:string
  requestId:string
  approvedByUserId:string
  reviewedAt:string
  expiresAt:string
  approved:boolean
  costCeilingUsd:number
  expectedCostUsd:number
  allowedMode:'preview'
  allowedWorkerId:string
  approvalReceiptId:string
}

export interface RecastPreviewAdmission {
  preflightPassed:boolean
  blockers:readonly string[]
  approvalReceiptId:string|null
  requiredNextAuthority:'CANONICAL_ACTION_EXECUTOR'
  workerCallAllowed:false
  executable:false
  canSpend:false
  canPublish:false
}

/** Only a server trusted policy engine can attest to the authenticity of an
 * approval receipt. Even when all inputs match, this is a dry-run admission
 * decision; it can NEVER call GPU workers or mint a permit. */
export function evaluateRecastPreviewAdmission(input:{
  handoff:RecastPreviewWorkerHandoff
  ledger:RecastReviewLedgerDecision
  duration:RecastDurationDecision
  review:RecastReviewedDecision
  ownerApproval:RecastPreviewOwnerAuthorization|null
  ownerUserId:string
  now:string
}):RecastPreviewAdmission {
  const blockers:string[]=[]
  const {handoff,ledger,duration,review,ownerApproval,ownerUserId}=input
  const nowMs=Date.parse(input.now)
  if(handoff.workerConnection!=='DISABLED'||handoff.executionPermit!==null||
    handoff.costAuthority!=='NONE'||handoff.publicationAuthority!=='NONE'||
    handoff.outputPolicy!=='UNAPPROVED_PREVIEW_ONLY')
    blockers.push('DIRECTOR_RECAST_PREVIEW_HANDOFF_INVALID')
  if(!ledger.receiptsComplete||ledger.reviewIds.length!==4)
    blockers.push('DIRECTOR_RECAST_REVIEW_LEDGER_INCOMPLETE')
  if(!duration.verified||duration.measuredDurationSeconds===null)
    blockers.push('DIRECTOR_RECAST_TRUSTED_VIDEO_DURATION_REQUIRED')
  if(!review.planningAdmissible)
    blockers.push('DIRECTOR_RECAST_REVIEWED_EVIDENCE_INCOMPLETE')
  if(!ownerApproval||!ownerApproval.approved||
    !ownerApproval.approvalReceiptId.trim()||
    ownerApproval.projectId!==handoff.projectId||
    ownerApproval.requestId!==handoff.requestId||
    ownerApproval.approvedByUserId!==ownerUserId||
    ownerApproval.allowedMode!=='preview'||
    !ownerApproval.allowedWorkerId.trim()||
    !Number.isFinite(ownerApproval.costCeilingUsd)||
    !Number.isFinite(ownerApproval.expectedCostUsd)||
    ownerApproval.costCeilingUsd<0||
    ownerApproval.expectedCostUsd<0||
    ownerApproval.expectedCostUsd>ownerApproval.costCeilingUsd||
    !Number.isFinite(nowMs)||
    !Number.isFinite(Date.parse(ownerApproval.reviewedAt))||
    !Number.isFinite(Date.parse(ownerApproval.expiresAt))||
    Date.parse(ownerApproval.reviewedAt)>nowMs||
    Date.parse(ownerApproval.expiresAt)<=nowMs||
    Date.parse(ownerApproval.expiresAt)-Date.parse(ownerApproval.reviewedAt)>30*60*1000)
    blockers.push('DIRECTOR_RECAST_FRESH_OWNER_APPROVAL_REQUIRED')
  blockers.push('DIRECTOR_RECAST_ACTION_EXECUTOR_PERMIT_REQUIRED')
  return Object.freeze({
    preflightPassed:blockers.length===1 && blockers[0]==='DIRECTOR_RECAST_ACTION_EXECUTOR_PERMIT_REQUIRED',
    blockers:Object.freeze(blockers),
    approvalReceiptId:ownerApproval&&blockers.length===1?ownerApproval.approvalReceiptId:null,
    requiredNextAuthority:'CANONICAL_ACTION_EXECUTOR',
    workerCallAllowed:false,executable:false,canSpend:false,canPublish:false,
  })
}
