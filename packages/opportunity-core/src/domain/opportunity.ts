export type OpportunityFamily =
  | 'funding'
  | 'recovery'
  | 'commerce'
  | 'employment'
  | 'business'
  | 'real_estate'
  | 'creator'
  | 'other'

export type OpportunityType =
  | 'grant'
  | 'contract'
  | 'prize'
  | 'tax_credit'
  | 'rebate'
  | 'subsidy'
  | 'loan'
  | 'investment'
  | 'accelerator'
  | 'in_kind'
  | 'recovery'
  | 'job'
  | 'gig'
  | 'commercial'
  | 'other'

export type OpportunityVerificationStatus =
  | 'unverified'
  | 'partially_verified'
  | 'verified'
  | 'rejected'

export type OpportunityStatus =
  | 'discovered'
  | 'research_pending'
  | 'verified'
  | 'ready'
  | 'approved'
  | 'pursuing'
  | 'won'
  | 'lost'
  | 'expired'
  | 'rejected'

export type OpportunityClaim = {
  id: string
  field: string
  value: unknown
  sourceId: string
  sourceType: 'official' | 'secondary' | 'user' | 'transcript' | 'model'
  confidence: number
  verified: boolean
}

export type OpportunityEvidence = {
  id: string
  sourceId: string
  sourceUrl: string
  sourceName: string
  sourceType: OpportunityClaim['sourceType']
  capturedAt: string
  excerpt?: string
  confidence: number
}

export type Opportunity = {
  id: string
  title: string
  family: OpportunityFamily
  type: OpportunityType
  description?: string
  sourceUrl: string
  sourceName: string
  sourceId?: string
  amount?: { min?: number; max?: number; currency: string }
  deadline?: string
  jurisdiction?: { country?: string; region?: string; locality?: string }
  eligibility?: Record<string, unknown>
  requirements?: string[]
  scoringRubric?: Record<string, number>
  claims: OpportunityClaim[]
  evidence: OpportunityEvidence[]
  verificationStatus: OpportunityVerificationStatus
  sourceConfidence: number
  fitScore?: number
  opportunityScore?: number
  expectedValue?: number
  effortScore?: number
  riskFlags: string[]
  brokerability?: 'restricted' | 'low' | 'medium' | 'high' | 'unknown'
  status: OpportunityStatus
  createdAt: string
  updatedAt: string
}
