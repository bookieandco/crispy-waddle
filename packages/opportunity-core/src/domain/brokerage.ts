export type BrokerageRole =
  | 'prime'
  | 'subcontractor'
  | 'teaming_partner'
  | 'specialist_vendor'
  | 'referral_partner'

export type CommercialDealStructure =
  | 'fixed'
  | 'referral_success'
  | 'percentage'
  | 'subcontract_margin'

export type FindingContract = {
  id: string
  opportunityId: string
  searchCriteria: string[]
  requiredCapabilities: string[]
  jurisdiction?: string
  evidenceRefs: string[]
  createdAt: string
  expiresAt?: string
}

export type ProviderCapabilityMatch = {
  id: string
  opportunityId: string
  providerId: string
  role: BrokerageRole
  score: number
  matchedCapabilities: string[]
  capabilityGaps: string[]
  complianceFlags: string[]
  evidenceRefs: string[]
  status: 'candidate' | 'qualified' | 'rejected'
  assessedAt: string
}

export type CommercialDealContract = {
  id: string
  opportunityId: string
  providerId: string
  role: BrokerageRole
  structure: CommercialDealStructure
  currency: string
  basis: string
  trigger: string
  fixedAmount?: number
  percentage?: number
  subcontractCost?: number
  complianceRequirements: string[]
  evidenceRefs: string[]
  status: 'draft' | 'review_ready' | 'approved' | 'rejected' | 'expired'
  requiresHumanApproval: true
  approvalReceiptRef?: string
  createdAt: string
  expiresAt?: string
}

export function validateFindingContract(contract: FindingContract): void {
  if (!contract.id.trim() || !contract.opportunityId.trim()) throw new Error('Finding contract identity is required')
  if (contract.searchCriteria.length === 0) throw new Error('Finding contract requires search criteria')
  if (contract.evidenceRefs.length === 0 || contract.evidenceRefs.some((ref) => !ref.trim())) throw new Error('Finding contract requires non-empty evidence references')
}

export function qualifyProviderMatch(match: ProviderCapabilityMatch): ProviderCapabilityMatch {
  if (!Number.isFinite(match.score) || match.score < 0 || match.score > 100) {
    throw new Error('Provider match score must be between 0 and 100')
  }
  if (match.evidenceRefs.length === 0 || match.evidenceRefs.some((ref) => !ref.trim())) throw new Error('Provider match requires non-empty evidence references')
  if (match.complianceFlags.length > 0 || match.capabilityGaps.length > 0 || match.score < 70) {
    return { ...match, status: 'candidate' }
  }
  return { ...match, status: 'qualified' }
}

export function validateCommercialDealContract(deal: CommercialDealContract): void {
  if (!deal.id.trim() || !deal.opportunityId.trim() || !deal.providerId.trim()) {
    throw new Error('Commercial deal identity is required')
  }
  if (!deal.currency.trim() || !deal.basis.trim() || !deal.trigger.trim()) {
    throw new Error('Commercial deal currency, basis, and trigger are required')
  }
  if (deal.complianceRequirements.length === 0) throw new Error('Commercial deal requires compliance requirements')
  if (deal.evidenceRefs.length === 0 || deal.evidenceRefs.some((ref) => !ref.trim())) throw new Error('Commercial deal requires non-empty evidence references')
  if (deal.fixedAmount !== undefined && (!Number.isFinite(deal.fixedAmount) || deal.fixedAmount < 0)) {
    throw new Error('Commercial deal fixed amount must be finite and non-negative')
  }
  if (deal.percentage !== undefined && (!Number.isFinite(deal.percentage) || deal.percentage < 0 || deal.percentage > 100)) {
    throw new Error('Commercial deal percentage must be between 0 and 100')
  }
  if (deal.subcontractCost !== undefined && (!Number.isFinite(deal.subcontractCost) || deal.subcontractCost < 0)) {
    throw new Error('Commercial deal subcontract cost must be finite and non-negative')
  }

  if (deal.structure === 'fixed' && deal.fixedAmount === undefined) {
    throw new Error('Fixed deal requires fixedAmount')
  }
  if ((deal.structure === 'referral_success' || deal.structure === 'percentage') && deal.percentage === undefined) {
    throw new Error('Percentage-based deal requires percentage')
  }
  if (deal.structure === 'subcontract_margin' && deal.subcontractCost === undefined) {
    throw new Error('Subcontract-margin deal requires subcontractCost')
  }
  if (deal.status === 'approved' && !deal.approvalReceiptRef?.trim()) {
    throw new Error('Approved commercial deal requires an external approval receipt')
  }
}
