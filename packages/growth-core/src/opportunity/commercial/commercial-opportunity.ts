import type { OpportunityEvidence, OpportunityEconomics, OpportunitySourceType } from '../domain/opportunity.js'

export type CommercialOpportunityKind =
  | 'affiliate'
  | 'ecommerce'
  | 'digital_product'
  | 'service'
  | 'software'
  | 'local_business'
  | 'market_intelligence'
  | 'content'

export type CommercialOpportunityRecord = {
  externalId?: string
  title: string
  description: string
  kind: CommercialOpportunityKind
  source: { name: string; type: OpportunitySourceType; url?: string }
  buyer?: { segment: string; geography?: string }
  problem?: string
  evidence: readonly OpportunityEvidence[]
  economics: OpportunityEconomics
}

export const normalizeCommercialOpportunity = (
  record: CommercialOpportunityRecord,
  userId: string,
  now = new Date().toISOString(),
) => ({
  id: record.externalId
    ? `commercial:${record.source.name}:${record.externalId}`
    : `commercial:${record.source.name}:${record.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
  userId,
  title: record.title,
  description: record.description,
  class: record.kind === 'service' ? 'freelance' : record.kind === 'software' ? 'asset' : 'experiment',
  strategy: record.kind === 'affiliate' ? 'affiliate' : record.kind === 'ecommerce' ? 'ecommerce' : record.kind === 'digital_product' ? 'digital_product' : record.kind === 'service' ? 'service' : 'market_intelligence',
  source: record.source,
  buyer: record.buyer,
  problem: record.problem,
  evidence: record.evidence,
  economics: record.economics,
  status: 'discovered',
  requiresApproval: true,
  createdAt: now,
  updatedAt: now,
})
