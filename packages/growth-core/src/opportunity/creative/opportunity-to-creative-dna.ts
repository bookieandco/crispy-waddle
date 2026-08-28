import type { Opportunity } from '../domain/opportunity.js'
import type { CreativeDNA } from './creative-dna.js'

export type CreativeBrief = Pick<CreativeDNA, 'opportunityId' | 'audience' | 'pain' | 'benefit' | 'sourceEvidenceIds'> & {
  objective: 'validate_demand' | 'generate_leads' | 'drive_sales' | 'drive_applications'
  evidenceQuality: number
}

function objectiveFor(opportunity: Opportunity): CreativeBrief['objective'] {
  if (opportunity.strategy === 'affiliate' || opportunity.strategy === 'ecommerce' || opportunity.strategy === 'digital_product') return 'drive_sales'
  if (opportunity.strategy === 'ai_service' || opportunity.strategy === 'freelance') return 'generate_leads'
  if (opportunity.strategy === 'government_contract' || opportunity.strategy === 'grant') return 'drive_applications'
  return 'validate_demand'
}

export function opportunityToCreativeBrief(opportunity: Opportunity): CreativeBrief {
  const evidence = opportunity.evidence ?? []
  return {
    opportunityId: opportunity.id,
    audience: opportunity.targetAudience ?? 'Potential buyers for this opportunity',
    pain: opportunity.problem ?? opportunity.description,
    benefit: opportunity.valueProposition ?? opportunity.title,
    sourceEvidenceIds: evidence.map((item) => item.id),
    objective: objectiveFor(opportunity),
    evidenceQuality: opportunity.score?.evidenceConfidence ?? 0,
  }
}
