/**
 * Evidence-only production pilot assessment. No side effects, communication,
 * wallet execution, credentials or unverified inferred success.
 */
export type PrimeFinderPilotEvidence={
  federalLatestScanSucceeded:boolean
  subnetScanReceipts:number
  activeSubnetListings:number
  certifiedLocalAdapters:number
  verifiedUniquePrimes:number
  qualifiedPackageProviderMatches:number
  primeSubRelationshipEdges:number
  evidencedCommercialOutcomes:number
  realSourcePilotPairs:number
  unauthorizedOutreachActions:number|null
}
export function certifyPrimeFinderPilot(e:PrimeFinderPilotEvidence){
  const blockers:string[]=[]
  if(!e.federalLatestScanSucceeded)blockers.push('Latest federal SAM backfill is not certified successful.')
  if(e.subnetScanReceipts<1||e.activeSubnetListings<1)blockers.push('No successful nonempty SUBNet source scan.')
  if(e.certifiedLocalAdapters<1)blockers.push('No certified local procurement source adapter.')
  if(e.verifiedUniquePrimes<3)blockers.push('Fewer than three independently identified prime accounts.')
  if(e.qualifiedPackageProviderMatches<3)blockers.push('Fewer than three qualified work-package/provider matches.')
  if(e.primeSubRelationshipEdges<3)blockers.push('Fewer than three persisted prime/provider CRM edges.')
  if(e.realSourcePilotPairs<3)blockers.push('Fewer than three source-backed end-to-end pilot pairs.')
  if(e.evidencedCommercialOutcomes<1)blockers.push('No evidenced commercial outcome; commercial completion remains unproven.')
  if(e.unauthorizedOutreachActions===null)blockers.push('Unauthorized-outreach audit has no verified evidence.')
  if(e.unauthorizedOutreachActions!==null&&e.unauthorizedOutreachActions>0)blockers.push('Unauthorized outreach violates the pursuit boundary.')
  return Object.freeze({
    status:blockers.length?'BLOCKED' as const:'EVIDENCE_ACCEPTED' as const,
    blockers,authority:'RESEARCH_ONLY' as const,
    outreachAuthorized:false as const,bidSubmissionAuthorized:false as const,
    signatureAuthorized:false as const,paymentAuthorized:false as const,
  })
}
