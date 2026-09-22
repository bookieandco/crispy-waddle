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
  provenanceComplete:boolean
  unauthorizedExternalActions:number
  silentFallbacks:number
}
export type SamUsableCertification={status:'pass'|'fail';failures:string[];evidence:SamUsableEvidence}
export function certifySamUsableFinal(evidence:SamUsableEvidence):SamUsableCertification{
  const failures:string[]=[]
  if(!evidence.runtimeBound)failures.push('Production runtime is not bound.')
  if(evidence.scanReceipts<1)failures.push('No successful production scanner receipt.')
  if(!evidence.marketCoverageComplete)failures.push('SAM market bootstrap coverage is incomplete.')
  if(evidence.marketCoverageDays<365)failures.push('SAM market bootstrap covers fewer than 365 days.')
  if(evidence.realNotices<3)failures.push('Fewer than three real SAM notices have traversed the pipeline.')
  if(evidence.noticesWithDocuments<3)failures.push('Fewer than three real notices have solicitation/document evidence.')
  if(evidence.noticesWithSubcontractability<3)failures.push('Fewer than three real notices have subcontractability decisions.')
  if(evidence.noticesWithProviderCandidates<3)failures.push('Fewer than three real notices have provider discovery results.')
  if(evidence.realProviderCandidates<3)failures.push('Insufficient real provider candidates.')
  if(evidence.noticesWithPursuitOptions<3)failures.push('Fewer than three real notices have persisted pursuit options.')
  if(evidence.noticesWithTeamCoverage<3)failures.push('Fewer than three real notices have evidence-backed provider-team coverage.')
  if(evidence.noticesWithCommercialReadiness<3)failures.push('Fewer than three real notices have commercial-readiness analysis.')
  if(!evidence.provenanceComplete)failures.push('Evidence provenance is incomplete.')
  if(evidence.unauthorizedExternalActions!==0)failures.push('Unauthorized external action detected.')
  if(evidence.silentFallbacks!==0)failures.push('Silent fallback detected.')
  return {status:failures.length?'fail':'pass',failures,evidence}
}
