import type { OpportunityClass } from './opportunity-class.js'
import type { OpportunityMatch } from './opportunity-match.js'
import type { OpportunityOutcome } from './opportunity-outcome.js'
import type { OpportunityScore } from './opportunity-score.js'
import type { OpportunityStatus } from './opportunity-status.js'
import type { OpportunityStrategy } from './opportunity-strategy.js'

export type OpportunitySourceType =
  | 'affiliate'
  | 'ecommerce'
  | 'digital_product'
  | 'service'
  | 'government'
  | 'subcontracting'
  | 'sba'
  | 'real_estate'
  | 'overage'
  | 'content'
  | 'software'
  | 'local_business'
  | 'market_intelligence'

export type OpportunityEvidence = {
  type: 'market' | 'buyer' | 'competitor' | 'pricing' | 'claim' | 'source'
  summary: string
  sourceUrl?: string
  confidence: number
}

export type OpportunityEconomics = {
  currency: string
  estimatedRevenue?: { min?: number; max?: number }
  startupCost?: number
  estimatedHours?: number
  recurringRevenue?: boolean
  paymentLikelihood?: number
}

export type Opportunity = {
  id: string
  userId: string
  title: string
  description: string
  class: OpportunityClass
  strategy: OpportunityStrategy
  source: {
    type: OpportunitySourceType
    name: string
    url?: string
    externalId?: string
  }
  buyer?: { segment: string; geography?: string }
  problem?: string
  evidence: readonly OpportunityEvidence[]
  economics: OpportunityEconomics
  score?: OpportunityScore
  match?: OpportunityMatch
  outcome?: OpportunityOutcome
  status: OpportunityStatus
  deadline?: string
  requiresApproval: boolean
  createdAt: string
  updatedAt: string
}
