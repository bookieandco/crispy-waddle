import { createHash } from 'node:crypto'
import type { SitePageObservation } from './business-growth-search-content.js'

/** JH-PERSONAL-SEO.07: safe preview/compare-and-swap contract, not CMS writes. */
export interface SeoRepairProposal {
  id:string
  pageUrl:string
  website:string
  field:'title'|'description'
  before:string
  after:string
  expectedBeforeSha256:string
  proposalSha256:string
  sourceEvidenceRef:string
  sourceObservedAt:string
  state:'PENDING_CANONICAL_ACTION_APPROVAL'
  automaticWriteAuthorized:false
  externalActionAuthorized:false
}
const hash=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex')
function url(input:string):URL{
  const parsed=new URL(input)
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port)
    throw new Error('SEO_REPAIR_HTTPS_REQUIRED')
  parsed.hash=''
  return parsed
}
export function preparePersonalSeoRepair(input:{
  registeredWebsite:string
  observedPage:SitePageObservation
  field:'title'|'description'
  suggestedText:string
  now:string
}):SeoRepairProposal{
  const website=url(input.registeredWebsite)
  const page=url(input.observedPage.url)
  if(website.origin!==page.origin)throw new Error('SEO_REPAIR_CROSS_SITE')
  if(!['title','description'].includes(input.field))
    throw new Error('SEO_REPAIR_FIELD_NOT_ALLOWED')
  if(!Number.isFinite(Date.parse(input.now))||Date.parse(input.observedPage.inspectedAt)>Date.parse(input.now)||
    Date.parse(input.now)-Date.parse(input.observedPage.inspectedAt)>3600_000)
    throw new Error('SEO_REPAIR_STALE_PAGE')
  if(input.observedPage.responseStatus!==200||input.observedPage.noindex)
    throw new Error('SEO_REPAIR_PAGE_NOT_ELIGIBLE')
  if(!input.observedPage.evidenceRef?.trim())throw new Error('SEO_REPAIR_EVIDENCE_REQUIRED')
  const after=input.suggestedText.trim().replace(/\s+/g,' ')
  const max=input.field==='title'?75:170
  if(!after||after.length>max||/[<>\u0000-\u001f]/.test(after))
    throw new Error('SEO_REPAIR_TEXT_INVALID')
  const before=(input.observedPage[input.field]??'').trim()
  if(before===after)throw new Error('SEO_REPAIR_NO_CHANGE')
  const digest=hash(before)
  const packet=[website.origin,page.toString(),input.field,digest,after,input.observedPage.evidenceRef].join('\n')
  return {
    id:'seo-repair:'+hash(packet),
    pageUrl:page.toString(),website:website.toString(),field:input.field,
    before,after,expectedBeforeSha256:digest,
    proposalSha256:hash(packet),sourceEvidenceRef:input.observedPage.evidenceRef,
    sourceObservedAt:input.observedPage.inspectedAt,
    state:'PENDING_CANONICAL_ACTION_APPROVAL',
    automaticWriteAuthorized:false,externalActionAuthorized:false,
  }
}
/**
 * Executor guard for a FUTURE CMS connector. Requires trusted approved exact
 * proposal hash and a fresh CMS read before an externally authorized write.
 * A browser "approved=true" is NOT acceptable as approvalReceipt evidence.
 */
export function assessSeoCmsWriteGate(input:{
  proposal:SeoRepairProposal
  currentFieldValue:string
  trustedCanonicalApproval?:{proposalSha256:string; approvedAt:string; trustedServerVerified:boolean}
}):{readyForAuthorizedAdapter:boolean;reason:string}{
  if(!input.trustedCanonicalApproval?.trustedServerVerified ||
    input.trustedCanonicalApproval.proposalSha256!==input.proposal.proposalSha256)
    return {readyForAuthorizedAdapter:false,reason:'CANONICAL_APPROVAL_REQUIRED'}
  if(!Number.isFinite(Date.parse(input.trustedCanonicalApproval.approvedAt)) ||
    Date.parse(input.trustedCanonicalApproval.approvedAt)<Date.parse(input.proposal.sourceObservedAt))
    return {readyForAuthorizedAdapter:false,reason:'APPROVAL_STALE'}
  if(hash(input.currentFieldValue.trim())!==input.proposal.expectedBeforeSha256)
    return {readyForAuthorizedAdapter:false,reason:'PAGE_CHANGED_REVIEW_AGAIN'}
  return {readyForAuthorizedAdapter:true,reason:'ADAPTER_MUST_INDEPENDENTLY_AUTHORIZE_AND_RECEIPT_WRITE'}
}
