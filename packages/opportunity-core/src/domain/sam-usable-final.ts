export type SamUsableEvidence={
  runtimeBound:boolean
  scanReceipts:number
  marketCoverageComplete:boolean
  marketCoverageDays:number
  realNotices:number
  noticesWithDocuments:number
  noticesWithSubcontractability:number
  noticesWithProviderCandidates:number
  realProviderCandidates:number
  noticesWithPursuitOptions:number
  noticesWithTeamCoverage:number
  noticesWithCommercialReadiness:number
  correlatedCompleteNotices:number
  provenanceComplete:boolean
  // These must be observed by a trusted, scope-complete external-action/fallback
  // audit. null means not observable and MUST NEVER be interpreted as zero.
  safetyEvidenceComplete:boolean
  unauthorizedExternalActions:number|null
  silentFallbacks:number|null
}
export type SamUsableCertification={status:'pass'|'fail';failures:string[];evidence:SamUsableEvidence}

export function certifySamUsableFinal(evidence:SamUsableEvidence):SamUsableCertification{
  const failures:string[]=[]
  if(!evidence.runtimeBound)failures.push('Production runtime is not bound.')
  if(!Number.isSafeInteger(evidence.scanReceipts)||evidence.scanReceipts<1)failures.push('No successful production scanner receipt.')
  if(!evidence.marketCoverageComplete)failures.push('SAM market bootstrap coverage is incomplete.')
  if(!Number.isFinite(evidence.marketCoverageDays)||evidence.marketCoverageDays<365)failures.push('SAM market bootstrap covers fewer than 365 days.')
  for(const [field,message] of [
    ['realNotices','Fewer than three real SAM notices have traversed the pipeline.'],
    ['noticesWithDocuments','Fewer than three real notices have solicitation/document evidence.'],
    ['noticesWithSubcontractability','Fewer than three real notices have subcontractability decisions.'],
    ['noticesWithProviderCandidates','Fewer than three real notices have qualified provider discovery results.'],
    ['realProviderCandidates','Insufficient qualified real provider candidates.'],
    ['noticesWithPursuitOptions','Fewer than three real notices have persisted pursuit options.'],
    ['noticesWithTeamCoverage','Fewer than three real notices have qualified provider-team coverage.'],
    ['noticesWithCommercialReadiness','Fewer than three real notices have evidence-backed quote readiness.'],
  ] as const){
    const n=evidence[field]
    if(!Number.isSafeInteger(n)||n<3)failures.push(message)
  }
  if(!Number.isSafeInteger(evidence.correlatedCompleteNotices)||evidence.correlatedCompleteNotices<3){
    failures.push('Fewer than three distinct SAM notices have a correlated complete evidence chain.')
  }
  if(!evidence.provenanceComplete)failures.push('Evidence provenance is incomplete or pagination was not exhaustive.')
  if(!evidence.safetyEvidenceComplete||!Number.isSafeInteger(evidence.unauthorizedExternalActions)||!Number.isSafeInteger(evidence.silentFallbacks)){
    failures.push('Trusted external-action and fallback audit is unavailable or incomplete.')
  }else{
    if(evidence.unauthorizedExternalActions!==0)failures.push('Unauthorized external action detected.')
    if(evidence.silentFallbacks!==0)failures.push('Silent fallback detected.')
  }
  return {status:failures.length?'fail':'pass',failures,evidence}
}

type Row=Record<string,unknown>
export type SamCertRows={
  catalog:Row[]
  documents:Row[]
  analysis:Row[]
  providers:Row[]
  pursuits:Row[]
}
export type SamCertRowMetrics=Pick<SamUsableEvidence,
  'realNotices'|'noticesWithDocuments'|'noticesWithSubcontractability'|
  'noticesWithProviderCandidates'|'realProviderCandidates'|
  'noticesWithPursuitOptions'|'noticesWithTeamCoverage'|
  'noticesWithCommercialReadiness'|'correlatedCompleteNotices'|'provenanceComplete'>

const record=(v:unknown):Row|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Row:null
const nonblank=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0
const entries=(v:unknown):Row[]=>Array.isArray(v)?v.map(record).filter((v):v is Row=>v!==null):[]
const texts=(v:unknown):string[]=>Array.isArray(v)?v.filter(nonblank):[]
const noticeId=(row:Row):string=>nonblank(row.notice_id)?row.notice_id:''
const unique=<T>(values:T[])=>new Set(values)

function credibleProvider(row:Row):boolean{
  if(row.status!=='candidate'||!nonblank(row.provider_key)||!nonblank(row.requirement_id))return false
  const sources=unique(texts(row.sources))
  const evidence=entries(row.evidence)
  const evidencedSources=unique(evidence.filter(e=>nonblank(e.id)&&nonblank(e.source)).map(e=>e.source as string))
  return sources.size>=2&&[...sources].every(s=>evidencedSources.has(s))
}
function validDocument(row:Row):boolean{
  return row.source_kind!=='notice'&&row.fetch_status==='text_captured'&&
    nonblank(row.source_url)&&nonblank(row.checksum)&&nonblank(row.extracted_text)
}
function usableAnalysis(row:Row):boolean{
  const status=record(row.subcontractability)?.status
  const requirements=entries(row.requirements)
  return status==='pass'&&requirements.length>0&&requirements.every(r=>nonblank(r.id))
}
function quoteReady(row:Row):boolean{
  const commercial=record(row.commercial)
  return row.status==='ready_for_quote'&&
    Array.isArray(row.blockers)&&row.blockers.length===0&&
    Array.isArray(row.uncovered_requirement_ids)&&row.uncovered_requirement_ids.length===0&&
    commercial?.status==='quote_required'&&
    typeof commercial.contractValue==='number'&&Number.isFinite(commercial.contractValue)&&commercial.contractValue>0&&
    Array.isArray(commercial.blockers)
}
function qualifiedAssignments(row:Row,providerRows:Row[],requirements:Set<string>):boolean{
  const assignments=entries(row.assignments)
  if(!assignments.length||!requirements.size)return false
  const covered=new Set<string>()
  for(const assignment of assignments){
    if(assignment.reviewRequired!==false||!nonblank(assignment.providerKey))return false
    const ids=texts(assignment.requirementIds)
    if(!ids.length)return false
    for(const id of ids){
      if(!requirements.has(id))return false
      if(!providerRows.some(p=>p.provider_key===assignment.providerKey&&p.requirement_id===id&&credibleProvider(p)))return false
      covered.add(id)
    }
  }
  return requirements.size===covered.size
}

/** SAM-CERT-HARDEN: evaluate ONE complete, correlated evidence set, not
 * independent populations that could each contain unrelated notices.
 * Caller must first exhaustively page each table or refuse certification.
 */
export function evaluateSamCertRows(input:SamCertRows):SamCertRowMetrics{
  const catalog=new Map(input.catalog.filter(r=>nonblank(r.notice_id)).map(r=>[noticeId(r),r]))
  const docs=new Map<string,Row[]>(),providers=new Map<string,Row[]>()
  const analysis=new Map(input.analysis.filter(r=>nonblank(r.notice_id)).map(r=>[noticeId(r),r]))
  const pursuits=new Map(input.pursuits.filter(r=>nonblank(r.notice_id)).map(r=>[noticeId(r),r]))
  for(const row of input.documents)if(nonblank(row.notice_id))docs.set(noticeId(row),[...(docs.get(noticeId(row))??[]),row])
  for(const row of input.providers)if(nonblank(row.notice_id))providers.set(noticeId(row),[...(providers.get(noticeId(row))??[]),row])
  const withDocs=new Set<string>(),withProviders=new Set<string>(),withAnalysis=new Set<string>()
  const withTeams=new Set<string>(),withCommercial=new Set<string>(),complete=new Set<string>()
  let providerCount=0
  for(const [id,row] of catalog){
    if((docs.get(id)??[]).some(validDocument))withDocs.add(id)
    const valid=(providers.get(id)??[]).filter(credibleProvider)
    providerCount+=valid.length
    if(valid.length)withProviders.add(id)
    const a=analysis.get(id)
    if(a&&usableAnalysis(a))withAnalysis.add(id)
    const p=pursuits.get(id)
    if(p&&quoteReady(p)){
      withCommercial.add(id)
      const requiredIds=new Set(entries(a?.requirements).map(r=>r.id).filter(nonblank))
      if(withAnalysis.has(id)&&qualifiedAssignments(p,valid,requiredIds))withTeams.add(id)
    }
    if(withDocs.has(id)&&withAnalysis.has(id)&&withProviders.has(id)&&withTeams.has(id)&&withCommercial.has(id))complete.add(id)
    void row
  }
  // Fail closed if even a single included row was missing source metadata or
  // an identity. The runtime is responsible for exhaustive, not capped, reads.
  const catalogProvenance=input.catalog.length>0&&input.catalog.every(r=>nonblank(r.notice_id)&&nonblank(r.source_url)&&nonblank(r.checksum))
  const documentProvenance=input.documents.every(r=>r.fetch_status!=='text_captured'||(
    nonblank(r.notice_id)&&nonblank(r.source_url)&&nonblank(r.checksum)&&nonblank(r.extracted_text)))
  const providerProvenance=input.providers.every(r=>r.status!=='candidate'||credibleProvider(r))
  return {
    realNotices:catalog.size,
    noticesWithDocuments:withDocs.size,
    noticesWithSubcontractability:withAnalysis.size,
    noticesWithProviderCandidates:withProviders.size,
    realProviderCandidates:providerCount,
    noticesWithPursuitOptions:[...pursuits.keys()].filter(id=>catalog.has(id)).length,
    noticesWithTeamCoverage:withTeams.size,
    noticesWithCommercialReadiness:withCommercial.size,
    correlatedCompleteNotices:complete.size,
    provenanceComplete:catalogProvenance&&documentProvenance&&providerProvenance,
  }
}
