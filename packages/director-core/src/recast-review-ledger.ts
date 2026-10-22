import type {RecastCandidateSelection,RecastReviewedEvidence} from './recast-reviewed-evidence'

/** Recast review receipts are *read-only inputs* supplied by a privileged
 * repository with independently governed human-review writes. A browser JSON
 * body or worker-generated claim is never a valid receipt origin. */
export type RecastReviewKind = 'media-probe'|'tracking'|'voice'|'rights'
export interface RecastReviewReceipt {
  id:string
  projectId:string
  ownerUserId:string
  kind:RecastReviewKind
  sourceVideoAssetId:string
  characterImageAssetId:string
  sourceAudioAssetId:string
  sourceVideoSha256:string
  characterImageSha256:string
  sourceAudioSha256:string
  reviewerId:string
  /** Server append timestamp, not a user-provided review clock. */
  createdAt?:string
  reviewedAt:string
  expiresAt:string
  status:'approved'|'rejected'
  method:'trusted-media-probe'|'human-review'
  evidence:unknown
}
export interface RecastReviewLedgerDecision {
  receiptsComplete:boolean
  blockers:readonly string[]
  reviewIds:readonly string[]
  renderAuthorized:false
  workerInvocationAllowed:false
  spendAuthority:'NONE'
}
const hash=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{64}$/i.test(s)
const word=(s:unknown):s is string=>typeof s==='string'&&s.trim().length>0
const kinds:readonly RecastReviewKind[]=['media-probe','tracking','voice','rights']

/** When a reviewer submits a later rejection, the previously approved receipt
 * must not remain sufficient. Require a single, unexpired, project-bound
 * approved review *per kind*, rather than shopping among historic approvals. */
export function verifyRecastReviewLedger(
  selection:RecastCandidateSelection,
  expectedHashes:Readonly<{video:string;image:string;audio:string}>,
  receipts:readonly RecastReviewReceipt[],
  checkedAt:string,
):RecastReviewLedgerDecision {
  const blockers:string[]=[]
  const reviewIds:string[]=[]
  const now=Date.parse(checkedAt)
  if(!word(selection.ownerUserId)||!word(selection.projectId)||
    ![expectedHashes.video,expectedHashes.image,expectedHashes.audio].every(hash)||
    !Number.isFinite(now))blockers.push('DIRECTOR_RECAST_LEDGER_INPUT_INVALID')
  for(const kind of kinds){
    const records=receipts.filter(r=>r.kind===kind)
    if(records.length!==1){
      blockers.push('DIRECTOR_RECAST_'+kind.toUpperCase().replace('-','_')+'_REVIEW_MISSING_OR_AMBIGUOUS')
      continue
    }
    const r=records[0]
    const method=kind==='media-probe'?'trusted-media-probe':'human-review'
    if(!word(r.id)||!word(r.reviewerId)||!word(r.reviewedAt)||!word(r.expiresAt)||
      !Number.isFinite(Date.parse(r.reviewedAt))||
      !Number.isFinite(Date.parse(r.expiresAt))||
      Date.parse(r.reviewedAt)>now||Date.parse(r.expiresAt)<=now||
      r.status!=='approved'||r.method!==method||
      r.projectId!==selection.projectId||r.ownerUserId!==selection.ownerUserId||
      r.sourceVideoAssetId!==selection.sourceVideoAssetId||
      r.characterImageAssetId!==selection.characterImageAssetId||
      r.sourceAudioAssetId!==selection.sourceAudioAssetId||
      r.sourceVideoSha256.toLowerCase()!==expectedHashes.video.toLowerCase()||
      r.characterImageSha256.toLowerCase()!==expectedHashes.image.toLowerCase()||
      r.sourceAudioSha256.toLowerCase()!==expectedHashes.audio.toLowerCase()||
      !r.evidence||typeof r.evidence!=='object'){
      blockers.push('DIRECTOR_RECAST_'+kind.toUpperCase().replace('-','_')+'_REVIEW_STALE_OR_UNTRUSTED')
      continue
    }
    reviewIds.push(r.id)
  }
  if(new Set(reviewIds).size!==reviewIds.length)blockers.push('DIRECTOR_RECAST_LEDGER_RECEIPT_REPLAY')
  return Object.freeze({
    receiptsComplete:blockers.length===0,
    blockers:Object.freeze(blockers),
    reviewIds:Object.freeze(reviewIds),
    renderAuthorized:false,workerInvocationAllowed:false,spendAuthority:'NONE',
  })
}

/** Parse the ledger's *payload*, only after verifying all 4 sealed receipt
 * identities and binding hashes. Still does not produce an execution permit. */
export function reviewedEvidenceFromLedger(
  selection:RecastCandidateSelection,
  receipts:readonly RecastReviewReceipt[],
  decision:RecastReviewLedgerDecision,
):RecastReviewedEvidence {
  if(!decision.receiptsComplete||decision.reviewIds.length!==4||
    decision.reviewIds.some(id=>!receipts.some(r=>r.id===id)))
    throw new Error('DIRECTOR_RECAST_LEDGER_NOT_ADMITTED')
  const record=(kind:RecastReviewKind)=>receipts.find(r=>r.kind===kind)!
  // The media-probe receipt holds two distinct forms: verified source metadata
  // and the offline ffprobe attestation. Neither is accepted from the browser.
  const mediaBundle=record('media-probe').evidence as {media?:RecastReviewedEvidence['media'];probe?:unknown}
  const media=mediaBundle?.media??null
  const tracking=record('tracking').evidence as RecastReviewedEvidence['tracking']
  const voice=record('voice').evidence as RecastReviewedEvidence['voice']
  const rights=record('rights').evidence as RecastReviewedEvidence['rights']
  if(!media||!tracking||!voice||!rights||media.projectId!==selection.projectId)
    throw new Error('DIRECTOR_RECAST_LEDGER_EVIDENCE_INVALID')
  return {media,tracking,voice,rights}
}
