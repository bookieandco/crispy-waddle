import {evaluateCommercialDeal,type CommercialAssumptions,type CommercialDealGate} from './commercial-deal-gate.js'
import {evaluateSamSubcontractability,type SubcontractabilityDecision,type SubcontractabilityInput} from './sam-subcontractability.js'
import type {FulfillmentPlan} from './fulfillment-plan.js'
import type {PublicSubcontractWorkPackage} from './public-award-prime.js'
import type {PrimeSubcontractorMatch} from './prime-subcontractor-matching.js'

export type PrimeFinderPursuitReadiness={
  status:'blocked'|'research_review'|'ready_for_human_review'
  blockers:string[]
  conditions:string[]
  commercial:CommercialDealGate
  subcontractability:SubcontractabilityDecision
  humanApprovalRequired:true
  outreachAuthorized:false
  bidSubmissionAuthorized:false
  signatureAuthorized:false
  paymentAuthorized:false
}

/**
 * Reuse canonical fulfillment, commercial and subcontractability engines.
 * This composes their decisions; it is NOT a second provider/contracting system.
 */
export function assessPrimeFinderPursuit(input:{
  package:PublicSubcontractWorkPackage
  match:PrimeSubcontractorMatch
  fulfillmentPlan:FulfillmentPlan
  commercialAssumptions:CommercialAssumptions
  subcontractability:SubcontractabilityInput
  primeSubcontractRequestVerified:boolean
  licenseAndCertificationEvidenceVerified:boolean
}):PrimeFinderPursuitReadiness{
  const commercial=evaluateCommercialDeal(input.fulfillmentPlan,input.commercialAssumptions)
  const subcontractability=evaluateSamSubcontractability(input.subcontractability)
  const blockers=[...input.package.blockers,...input.match.blockers,...commercial.blockers,...subcontractability.hardBlockers]
  const conditions=[...subcontractability.conditions]
  if(input.package.status!=='candidate')blockers.push('Work package is not fully evidence-qualified.')
  if(input.match.disposition!=='matched_candidate')blockers.push('Subcontractor match is not qualified.')
  if(!input.primeSubcontractRequestVerified)blockers.push('Prime subcontracting requirement or invitation is not independently verified.')
  if((input.package.requiredLicenses.length||input.package.requiredCertifications.length)&&!input.licenseAndCertificationEvidenceVerified)
    blockers.push('Required trade licenses/certifications have not been verified.')
  if(subcontractability.status==='review_required'||subcontractability.status==='conditional')
    conditions.push('Solicitation-specific subcontractability rules require human review.')
  const uniqueBlockers=[...new Set(blockers)]
  return {
    status:uniqueBlockers.length?'blocked':
      subcontractability.status==='pass'&&commercial.status==='commercially_viable'
        ?'ready_for_human_review':'research_review',
    blockers:uniqueBlockers,
    conditions:[...new Set(conditions)],
    commercial,subcontractability,
    humanApprovalRequired:true,outreachAuthorized:false,bidSubmissionAuthorized:false,
    signatureAuthorized:false,paymentAuthorized:false,
  }
}
