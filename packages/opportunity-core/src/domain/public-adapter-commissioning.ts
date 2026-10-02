import type { PublicSourceAdapterKind } from './public-opportunity-grid.js'
import type { PublicProcurementSourceCandidate } from './public-source-discovery.js'

export type PublicPortalFamily=
  |'native_government'
  |'opengov'
  |'planetbids'
  |'bidnet_direct'
  |'bonfire'
  |'public_purchase'
  |'ionwave'
  |'demandstar'
  |'periscope_s2g'
  |'bids_and_tenders'
  |'unknown'

export type PublicAdapterTemplateKind=
  |'generic_html_table'
  |'generic_rss_atom'
  |'generic_json_collection'
  |'portal_specific'
  |'manual_required'

export type PublicAdapterCommissioningPlan={
  sourceUrl:string
  portalFamily:PublicPortalFamily
  templateKind:PublicAdapterTemplateKind
  adapterKind:PublicSourceAdapterKind
  status:'SHADOW_READY'|'PORTAL_TEMPLATE_REQUIRED'|'MANUAL_REVIEW_REQUIRED'|'BLOCKED'
  reasons:string[]
  requiredEvidence:string[]
  automaticActivationAuthorized:false
  readOnly:true
}

const host=(raw:string)=>{
  try{return new URL(raw).hostname.toLowerCase().replace(/^www\./,'')}catch{return''}
}
const includesHost=(value:string,base:string)=>value===base||value.endsWith('.'+base)

export function fingerprintPublicPortal(rawUrl:string):PublicPortalFamily{
  const value=host(rawUrl)
  if(!value)return'unknown'
  if(value.endsWith('.gov'))return'native_government'
  if(includesHost(value,'opengov.com'))return'opengov'
  if(includesHost(value,'planetbids.com'))return'planetbids'
  if(includesHost(value,'bidnetdirect.com'))return'bidnet_direct'
  if(includesHost(value,'bonfirehub.com'))return'bonfire'
  if(includesHost(value,'publicpurchase.com'))return'public_purchase'
  if(includesHost(value,'ionwave.net'))return'ionwave'
  if(includesHost(value,'demandstar.com'))return'demandstar'
  if(includesHost(value,'periscopeholdings.com'))return'periscope_s2g'
  if(includesHost(value,'bidsandtenders.net'))return'bids_and_tenders'
  return'unknown'
}

export function planPublicAdapterCommissioning(
  source:Pick<PublicProcurementSourceCandidate,'sourceUrl'|'adapterKind'|'status'|'evidenceRefs'|'blockers'>,
):PublicAdapterCommissioningPlan{
  const portalFamily=fingerprintPublicPortal(source.sourceUrl)
  const reasons:string[]=[]
  const requiredEvidence:string[]=[]
  const verified=source.status==='official_owner_verified'||source.status==='official_portal_verified'

  if(!verified){
    return {
      sourceUrl:source.sourceUrl,
      portalFamily,
      templateKind:'manual_required',
      adapterKind:source.adapterKind,
      status:'BLOCKED',
      reasons:['Source must be officially corroborated before adapter commissioning.'],
      requiredEvidence:['official_source_verification'],
      automaticActivationAuthorized:false,
      readOnly:true,
    }
  }

  let templateKind:PublicAdapterTemplateKind='manual_required'
  let status:PublicAdapterCommissioningPlan['status']='MANUAL_REVIEW_REQUIRED'

  if(source.adapterKind==='rss'){
    templateKind='generic_rss_atom'
    status='SHADOW_READY'
    reasons.push('Verified RSS/Atom-style source can enter generic read-only shadow parsing.')
  }else if(source.adapterKind==='api'){
    templateKind='generic_json_collection'
    status='SHADOW_READY'
    reasons.push('Verified API/JSON-style source can enter generic read-only shadow parsing after field mapping.')
    requiredEvidence.push('json_field_mapping')
  }else if(source.adapterKind==='html'&&portalFamily==='native_government'){
    templateKind='generic_html_table'
    status='SHADOW_READY'
    reasons.push('Verified native government HTML source can enter generic table/link shadow parsing.')
    requiredEvidence.push('table_or_link_mapping')
  }else if(source.adapterKind==='portal'||portalFamily!=='unknown'&&portalFamily!=='native_government'){
    templateKind='portal_specific'
    status='PORTAL_TEMPLATE_REQUIRED'
    reasons.push('Verified procurement portal requires a platform-specific read-only adapter or documented public feed.')
    requiredEvidence.push('portal_access_review','portal_parser_fixture')
  }else{
    reasons.push('Source shape does not match an admitted generic adapter template.')
    requiredEvidence.push('manual_adapter_review')
  }

  requiredEvidence.push('stable_external_ids','provenance_preserved','shadow_trials')
  return {
    sourceUrl:source.sourceUrl,
    portalFamily,
    templateKind,
    adapterKind:source.adapterKind,
    status,
    reasons,
    requiredEvidence:[...new Set(requiredEvidence)],
    automaticActivationAuthorized:false,
    readOnly:true,
  }
}

export type PublicAdapterTrial={
  id:string
  sourceId:string
  adapterKey:string
  adapterVersion:string
  observedAt:string
  sourceDigest:string
  httpStatus:number
  parseSucceeded:boolean
  observationCount:number
  stableExternalIdCount:number
  duplicateExternalIdCount:number
  provenanceComplete:boolean
  accessReviewApproved:boolean
  errorCode?:string
  evidenceRefs:string[]
}

export type PublicAdapterCertification={
  sourceId:string
  adapterKey:string
  adapterVersion:string
  trialCount:number
  successfulTrials:number
  observationCount:number
  stableExternalIdCoverage:number
  status:'ACTIVE_READ_ONLY'|'SHADOW'|'BLOCKED'
  blockers:string[]
  evidenceRefs:string[]
  readOnly:true
  externalActionAuthorized:false
}

export function certifyPublicAdapter(input:{
  sourceId:string
  adapterKey:string
  adapterVersion:string
  sourceVerified:boolean
  trials:PublicAdapterTrial[]
  minimumSuccessfulTrials?:number
}):PublicAdapterCertification{
  const minimum=Math.max(2,Math.min(input.minimumSuccessfulTrials??3,5))
  const rows=input.trials
    .filter(t=>t.sourceId===input.sourceId&&t.adapterKey===input.adapterKey&&t.adapterVersion===input.adapterVersion)
    .sort((a,b)=>a.observedAt.localeCompare(b.observedAt))
  const successful=rows.filter(t=>t.parseSucceeded&&t.httpStatus>=200&&t.httpStatus<300&&t.provenanceComplete&&t.accessReviewApproved)
  const observations=successful.reduce((sum,t)=>sum+Math.max(0,t.observationCount),0)
  const stableIds=successful.reduce((sum,t)=>sum+Math.max(0,t.stableExternalIdCount),0)
  const duplicateIds=successful.reduce((sum,t)=>sum+Math.max(0,t.duplicateExternalIdCount),0)
  const structurallyEmpty=successful.length>=minimum&&observations===0
  const stableExternalIdCoverage=observations>0
    ?Math.max(0,Math.min(1,stableIds/observations))
    :structurallyEmpty?1:0
  const blockers:string[]=[]

  if(!input.sourceVerified)blockers.push('Source is not officially verified.')
  if(rows.some(t=>!t.accessReviewApproved))blockers.push('One or more adapter trials lack access-review approval.')
  if(successful.length<minimum)blockers.push(`Successful read-only shadow trials ${successful.length}/${minimum}.`)
  if(observations===0&&!structurallyEmpty)blockers.push('Successful trials produced no opportunity observations.')
  if(!structurallyEmpty&&stableExternalIdCoverage<0.95)blockers.push(`Stable external-ID coverage is below 95%: ${Math.round(stableExternalIdCoverage*100)}%.`)
  if(duplicateIds>0)blockers.push(`Duplicate external IDs observed across successful trials: ${duplicateIds}.`)
  if(rows.some(t=>!t.provenanceComplete))blockers.push('One or more adapter trials lost source provenance.')

  let status:PublicAdapterCertification['status']='SHADOW'
  if(!input.sourceVerified||rows.some(t=>!t.accessReviewApproved)||duplicateIds>0)status='BLOCKED'
  else if(blockers.length===0)status='ACTIVE_READ_ONLY'

  return {
    sourceId:input.sourceId,
    adapterKey:input.adapterKey,
    adapterVersion:input.adapterVersion,
    trialCount:rows.length,
    successfulTrials:successful.length,
    observationCount:observations,
    stableExternalIdCoverage,
    status,
    blockers:[...new Set(blockers)],
    evidenceRefs:[...new Set(rows.flatMap(t=>t.evidenceRefs))],
    readOnly:true,
    externalActionAuthorized:false,
  }
}


export type PublicAdapterQueueDisposition={
  adapterStatus:'adapter_required'|'active'|'degraded'
  terminalForConvergence:boolean
  reason:string
}

export function resolvePublicAdapterQueueDisposition(input:{
  planStatus?:PublicAdapterCommissioningPlan['status']
  accessApproved?:boolean
  certification?:Pick<PublicAdapterCertification,'status'|'trialCount'|'blockers'>
  convergence?:boolean
  minimumShadowTrials?:number
}):PublicAdapterQueueDisposition{
  const minimum=Math.max(1,Math.min(input.minimumShadowTrials??3,5))
  if(input.planStatus&&input.planStatus!=='SHADOW_READY'){
    return {
      adapterStatus:'degraded',
      terminalForConvergence:true,
      reason:`adapter_plan_${input.planStatus.toLowerCase()}`,
    }
  }
  if(input.accessApproved===false&&input.convergence){
    return {
      adapterStatus:'degraded',
      terminalForConvergence:true,
      reason:'adapter_access_not_approved',
    }
  }
  if(input.certification?.status==='ACTIVE_READ_ONLY'){
    return {
      adapterStatus:'active',
      terminalForConvergence:true,
      reason:'adapter_certified_active_read_only',
    }
  }
  if(input.certification?.status==='BLOCKED'){
    return {
      adapterStatus:'degraded',
      terminalForConvergence:true,
      reason:'adapter_certification_blocked',
    }
  }
  if(
    input.convergence&&
    input.certification?.status==='SHADOW'&&
    input.certification.trialCount>=minimum
  ){
    return {
      adapterStatus:'degraded',
      terminalForConvergence:true,
      reason:'adapter_shadow_window_exhausted',
    }
  }
  return {
    adapterStatus:'adapter_required',
    terminalForConvergence:false,
    reason:'adapter_shadow_pending',
  }
}

export type PublicReadAccessObservation={
  sourceVerified:boolean
  officialGovernmentDomain:boolean
  https:boolean
  unauthenticatedGet:boolean
  robots:'allowed'|'disallowed'|'unknown'
  accessChallenge:boolean
  evidenceRefs:string[]
}

export type PublicReadAccessAssessment={
  status:'APPROVED_READ_ONLY'|'MANUAL_REVIEW_REQUIRED'|'BLOCKED'
  reasons:string[]
  evidenceRefs:string[]
  readOnly:true
  credentialBypassAuthorized:false
}

export function assessPublicReadAccess(observation:PublicReadAccessObservation):PublicReadAccessAssessment{
  const reasons:string[]=[]
  let status:PublicReadAccessAssessment['status']='APPROVED_READ_ONLY'
  if(!observation.sourceVerified){
    status='BLOCKED'
    reasons.push('Source is not officially verified.')
  }
  if(observation.robots==='disallowed'){
    status='BLOCKED'
    reasons.push('Robots policy disallows the source path for automated retrieval.')
  }
  if(!observation.https){
    if(status!=='BLOCKED')status='MANUAL_REVIEW_REQUIRED'
    reasons.push('Source is not HTTPS.')
  }
  if(!observation.officialGovernmentDomain){
    if(status!=='BLOCKED')status='MANUAL_REVIEW_REQUIRED'
    reasons.push('Non-government host requires explicit portal access review.')
  }
  if(!observation.unauthenticatedGet||observation.accessChallenge){
    if(status!=='BLOCKED')status='MANUAL_REVIEW_REQUIRED'
    reasons.push('Public unauthenticated read access was not cleanly established.')
  }
  if(observation.robots==='unknown'){
    if(status!=='BLOCKED')status='MANUAL_REVIEW_REQUIRED'
    reasons.push('Robots policy could not be established.')
  }
  return {
    status,
    reasons:[...new Set(reasons)],
    evidenceRefs:[...new Set(observation.evidenceRefs)],
    readOnly:true,
    credentialBypassAuthorized:false,
  }
}
