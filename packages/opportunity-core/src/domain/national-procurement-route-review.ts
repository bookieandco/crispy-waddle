/**
 * Cross-jurisdiction commercial/pursuit acceptance checklist.
 * Evidence is independently recorded per gate, not inferred from a high match score.
 */
export type ProcurementAngle='direct_prime'|'teaming'|'subcontract'|'supplier_reseller'|'cooperative'|'incumbent_relationship'
export type EvidenceGate='official_notice'|'amendments'|'buyer_identity'|'bidder_legal_role'|'prime_and_sub_rules'
 |'registration_prequalification'|'set_aside_eligibility'|'licenses'|'bonds'|'insurance'|'labor_and_wage'
 |'site_visit_and_QA'|'scope_and_quantities'|'supplier_capacity'|'scope_specific_consent'
 |'written_quote'|'tax_freight_and_delivery'|'overhead_warranty_and_contingency'|'cashflow_retainage_payment'
 |'required_forms'|'deadline'|'human_approval'
export const NATIONAL_PURSUIT_GATES:readonly EvidenceGate[]=[
 'official_notice','amendments','buyer_identity','bidder_legal_role','prime_and_sub_rules',
 'registration_prequalification','set_aside_eligibility','licenses','bonds','insurance','labor_and_wage',
 'site_visit_and_QA','scope_and_quantities','supplier_capacity','scope_specific_consent',
 'written_quote','tax_freight_and_delivery','overhead_warranty_and_contingency',
 'cashflow_retainage_payment','required_forms','deadline','human_approval',
]
export type ProcurementGateEvidence={gate:EvidenceGate;status:'verified'|'not_applicable_officially'|'unknown'|'failed'
 evidenceRefs:string[];checkedAt?:string}
export function assessNationalProcurementPursuit(input:{
 opportunityId:string;angle:ProcurementAngle;gates:ProcurementGateEvidence[]
}){
 if(!input.opportunityId.trim())throw Error('Canonical opportunity ID is required')
 const byGate=new Map<EvidenceGate,ProcurementGateEvidence>()
 for(const row of input.gates){
  if(!NATIONAL_PURSUIT_GATES.includes(row.gate))throw Error('Unsupported procurement compliance gate')
  if(byGate.has(row.gate))throw Error('Duplicate procurement compliance gate')
  byGate.set(row.gate,row)
 }
 const missing:EvidenceGate[]=[]
 const failed:EvidenceGate[]=[]
 for(const gate of NATIONAL_PURSUIT_GATES){
  const evidence=byGate.get(gate)
  if(evidence?.status==='failed')failed.push(gate)
  if(!evidence||evidence.status==='unknown'||(evidence.status==='verified'&&!evidence.evidenceRefs.length)||
   (evidence.status==='not_applicable_officially'&&!evidence.evidenceRefs.length))missing.push(gate)
 }
 // Even "all verified" isn't delegated authority; canonical commercial gate,
 // owner's explicit permission and submission safeguards are separate systems.
 return {opportunityId:input.opportunityId,angle:input.angle,
  evidencedGates:NATIONAL_PURSUIT_GATES.length-missing.length-failed.length,
  totalGates:NATIONAL_PURSUIT_GATES.length,
  missing,failed,status:failed.length?'blocked':missing.length?'review_required':'human_approval_required',
  noSend:true,readinessIsNotAnAuthorization:true,
  routeReadyForSubmission:false,externalContactAuthorized:false,bidSubmissionAuthorized:false,
  signingAuthorized:false,paymentAuthorized:false}
}
