import type {RecastReviewKind,RecastReviewReceipt} from './recast-review-ledger'

const reviewKinds:readonly RecastReviewKind[]=['media-probe','tracking','voice','rights']

export interface RecastEffectiveReviews {
  reviews:readonly RecastReviewReceipt[]
  blockers:readonly string[]
  reviewHistoryObserved:number
  complete:boolean
}

/** An append-only registry may contain historical approvals, later revocations,
 * and a subsequent fresh review. Only the unique most-recent receipt per kind
 * can carry current authority. A tie, future receipt or duplicate identity
 * makes the selection untrustworthy; never fall back to an older approval. */
export function resolveEffectiveRecastReviews(
  receipts:readonly RecastReviewReceipt[],
  asOf:string,
  historyTruncated=false,
):RecastEffectiveReviews {
  const blockers:string[]=[]
  const reviews:RecastReviewReceipt[]=[]
  const now=Date.parse(asOf)
  if(!Number.isFinite(now)||historyTruncated)
    blockers.push('DIRECTOR_RECAST_REVIEW_HISTORY_INCOMPLETE')
  if(receipts.length>128)
    blockers.push('DIRECTOR_RECAST_REVIEW_HISTORY_LIMIT_EXCEEDED')
  const ids=new Set<string>()
  for(const r of receipts){
    if(!r.id||ids.has(r.id)){
      blockers.push('DIRECTOR_RECAST_REVIEW_RECEIPT_REPLAY')
      break
    }
    ids.add(r.id)
  }
  for(const kind of reviewKinds){
    const matching=receipts.filter(r=>r.kind===kind)
    if(!matching.length){
      blockers.push('DIRECTOR_RECAST_'+kind.toUpperCase().replace('-','_')+'_REVIEW_MISSING')
      continue
    }
    // A future-dated review is not silently excluded: it may hide a forged
    // approval or rejection and makes the entire kind untrustworthy.
    if(matching.some(r=>!Number.isFinite(Date.parse(r.reviewedAt))||
      !Number.isFinite(now)||Date.parse(r.reviewedAt)>now)){
      blockers.push('DIRECTOR_RECAST_'+kind.toUpperCase().replace('-','_')+'_REVIEW_CLOCK_INVALID')
      continue
    }
    const sorted=[...matching].sort((a,b)=>Date.parse(b.reviewedAt)-Date.parse(a.reviewedAt))
    if(sorted.length>1&&Date.parse(sorted[0].reviewedAt)===Date.parse(sorted[1].reviewedAt)){
      blockers.push('DIRECTOR_RECAST_'+kind.toUpperCase().replace('-','_')+'_REVIEW_TIE')
      continue
    }
    // Deliberately retain rejections/expired latest receipts. The canonical
    // verifier must see and deny those; no earlier record may replace them.
    reviews.push(sorted[0])
  }
  return Object.freeze({
    reviews:Object.freeze(reviews),
    blockers:Object.freeze(blockers),
    reviewHistoryObserved:receipts.length,
    complete:blockers.length===0&&reviews.length===reviewKinds.length,
  })
}
