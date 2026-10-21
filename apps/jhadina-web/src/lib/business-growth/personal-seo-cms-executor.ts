import 'server-only'
import { assessSeoCmsWriteGate, type SeoRepairProposal } from '@jhadina/growth-core'

/**
 * JH-PERSONAL-SEO.07 canonical CMS transaction boundary.
 * Not exposed as a web route. The owning Action Core integration must supply
 * a verified, owner-scoped approval lookup and a real versioned CMS adapter.
 * No credentials, browser approvals, or generic arbitrary URL writes accepted.
 */
export interface VersionedCmsField {
  value:string
  revision:string
}
export interface ApprovedSeoAction {
  proposalSha256:string
  approvedAt:string
  approvedByUserId:string
  providerAccountId:string
  receiptId:string
  trustedServerVerified:true
}
export interface VersionedCmsAdapter {
  providerAccountId:string
  /** Read the exact registered CMS property; no arbitrary destination URL. */
  read(input:{pageUrl:string;field:'title'|'description'}):Promise<VersionedCmsField>
  /** Conditional write; adapter MUST reject revision conflicts. */
  compareAndSet(input:{pageUrl:string;field:'title'|'description';
    expectedRevision:string;value:string;idempotencyKey:string}):Promise<{revision:string;providerReceiptId:string}>
}
export type SeoCmsResult={
  status:'APPLIED_AND_VERIFIED'|'ROLLBACK_VERIFIED'|'FAILED_CLOSED'
  proposalSha256:string
  providerReceiptIds:string[]
  reason:string
  seoRankingImprovementProven:false
}
/** Server-side only; caller must independently verify owner's action receipt. */
export async function executeApprovedPersonalSeoFix(input:{
  proposal:SeoRepairProposal
  ownerUserId:string
  adapter:VersionedCmsAdapter
  loadCanonicalApproval:(proposalSha256:string)=>Promise<ApprovedSeoAction|null>
}):Promise<SeoCmsResult>{
  const fail=(reason:string,receipts:string[]=[]):SeoCmsResult=>({
    status:'FAILED_CLOSED',proposalSha256:input.proposal.proposalSha256,
    providerReceiptIds:receipts,reason,seoRankingImprovementProven:false,
  })
  if(!input.ownerUserId?.trim()||input.proposal.state!=='PENDING_CANONICAL_ACTION_APPROVAL')
    return fail('INVALID_OWNER_OR_PROPOSAL')
  // Approval comes ONLY from independent server-side Action Core persistence.
  const approved=await input.loadCanonicalApproval(input.proposal.proposalSha256)
  if(!approved||approved.trustedServerVerified!==true||
    approved.approvedByUserId!==input.ownerUserId||
    approved.providerAccountId!==input.adapter.providerAccountId||
    !approved.receiptId?.trim())
    return fail('CANONICAL_ACTION_APPROVAL_NOT_VERIFIED')
  const before=await input.adapter.read({
    pageUrl:input.proposal.pageUrl,field:input.proposal.field,
  })
  if(!before.revision?.trim())return fail('CMS_REVISION_MISSING')
  const gate=assessSeoCmsWriteGate({
    proposal:input.proposal,currentFieldValue:before.value,
    trustedCanonicalApproval:{proposalSha256:approved.proposalSha256,
      approvedAt:approved.approvedAt,trustedServerVerified:true},
  })
  if(!gate.readyForAuthorizedAdapter)return fail(gate.reason)
  let write:{revision:string;providerReceiptId:string}
  try{
    write=await input.adapter.compareAndSet({
      pageUrl:input.proposal.pageUrl,field:input.proposal.field,
      expectedRevision:before.revision,value:input.proposal.after,
      idempotencyKey:input.proposal.id,
    })
  }catch{return fail('CMS_WRITE_FAILED_OR_REVISION_CONFLICT')}
  const receipts=[write.providerReceiptId]
  try{
    const after=await input.adapter.read({pageUrl:input.proposal.pageUrl,
      field:input.proposal.field})
    if(after.value===input.proposal.after && after.revision===write.revision)
      return {status:'APPLIED_AND_VERIFIED',
        proposalSha256:input.proposal.proposalSha256,providerReceiptIds:receipts,
        reason:'EXACT_APPROVED_CMS_CHANGE_VERIFIED',seoRankingImprovementProven:false}
    // Revert only if the revision is the one this exact transaction wrote.
    // Never overwrite concurrent external edits.
    if(after.revision===write.revision){
      const restore=await input.adapter.compareAndSet({
        pageUrl:input.proposal.pageUrl,field:input.proposal.field,
        expectedRevision:after.revision,value:input.proposal.before,
        idempotencyKey:input.proposal.id+':rollback',
      })
      receipts.push(restore.providerReceiptId)
      const final=await input.adapter.read({pageUrl:input.proposal.pageUrl,
        field:input.proposal.field})
      if(final.value===input.proposal.before && final.revision===restore.revision)
        return {status:'ROLLBACK_VERIFIED',proposalSha256:input.proposal.proposalSha256,
          providerReceiptIds:receipts,reason:'POST_WRITE_VERIFICATION_FAILED_REVERTED',
          seoRankingImprovementProven:false}
    }
  }catch { /* ambiguous provider write/rollback is never claimed successful */ }
  return fail('UNVERIFIED_CMS_STATE_REQUIRES_MANUAL_REVIEW',receipts)
}
