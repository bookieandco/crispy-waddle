import {verifyRecastEvidenceSeal} from './recast-review-digest'
import type {RecastUnpersistedReceipt} from './recast-review-insert-manifest'

export interface RecastStagingWriteAuthorization {
  databaseEnvironment:'disposable-preview-branch'
  productionProjectRef:string
  branchProjectRef:string
  branchHealthy:boolean
  schemaAndRlsAudited:boolean
  independentReviewerAuthenticated:boolean
  operatorWriteApprovalId:string
  reviewerUserId:string
  explicitlyCommissioned:boolean
}
export interface RecastStagingReceiptSink {
  insertReviewReceipt(
    table:'director_recast_review_receipts',
    row:Omit<RecastUnpersistedReceipt,'disposition'>,
  ):Promise<{id:string}|null>
}

export type RecastStagingWriteResult=Readonly<{
  stagedReceiptId:string
  persistedTo:'ISOLATED_STAGING_ONLY'
  rendered:false
  spent:false
  published:false
}>

/** Not connected to any HTTP route, Supabase client or production runtime.
 * An independently provisioned, operator-approved *disposable* staging sink
 * is injected by a future executor. No user-controlled input may construct the
 * authorization; the caller is responsible for obtaining it out of band. */
export async function persistRecastReceiptInIsolatedStaging(
  receipt:RecastUnpersistedReceipt,
  auth:RecastStagingWriteAuthorization,
  sink:RecastStagingReceiptSink,
):Promise<RecastStagingWriteResult> {
  if(receipt.disposition!=='UNPERSISTED_INSERT_MANIFEST'||
    !auth.explicitlyCommissioned||!auth.branchHealthy||
    !auth.schemaAndRlsAudited||!auth.independentReviewerAuthenticated||
    !auth.operatorWriteApprovalId.trim()||
    !auth.productionProjectRef.trim()||
    !auth.branchProjectRef.trim()||
    auth.branchProjectRef===auth.productionProjectRef||
    auth.branchProjectRef==='main'||
    auth.reviewerUserId!==receipt.reviewed_by_user_id||
    !verifyRecastEvidenceSeal(receipt.evidence,receipt.evidence_sha256)) {
    throw new Error('DIRECTOR_RECAST_ISOLATED_STAGING_COMMISSION_REQUIRED')
  }
  const {disposition:_disposition,...row}=receipt
  const recorded=await sink.insertReviewReceipt('director_recast_review_receipts',row)
  if(!recorded||recorded.id!==receipt.id) {
    throw new Error('DIRECTOR_RECAST_STAGING_RECEIPT_INSERT_NOT_CONFIRMED')
  }
  return Object.freeze({
    stagedReceiptId:receipt.id,
    persistedTo:'ISOLATED_STAGING_ONLY',
    rendered:false,spent:false,published:false,
  })
}