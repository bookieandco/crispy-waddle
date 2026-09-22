import type { OpportunityHubCategory } from './taxonomy.js'

export type SideHustleFamily =
  | 'ai_business_implementation'
  | 'business_automation'
  | 'business_systems'
  | 'lead_generation_growth'
  | 'ai_discovery_seo'
  | 'content_social'
  | 'creative_advertising'
  | 'media_production'
  | 'owned_media'
  | 'creator_monetization'
  | 'digital_products'
  | 'software_apps'
  | 'communities'
  | 'pod_personalized_commerce'
  | 'commerce_affiliate'
  | 'dropshipping_product_commerce'
  | 'drop_servicing'
  | 'directories_marketplaces'
  | 'physical_asset_businesses'
  | 'boring_business_services'
  | 'research_services'
  | 'procurement_subcontracting'
  | 'website_revenue_systems'
  | 'human_premium_services'
  | 'trading_investing_intelligence'
  | 'pr_authority'

export type SideHustleRole = 'standalone' | 'add_on' | 'capability'

export type SideHustleAutomationMaturity =
  | 'unvalidated'
  | 'human_delivered'
  | 'ai_assisted'
  | 'workflow_automated'
  | 'exception_managed'
  | 'autonomous_cell'

export type SideHustleMonetizationModel =
  | 'affiliate_commission'
  | 'fulfillment_margin'
  | 'inventory_resale_margin'
  | 'print_on_demand_margin'
  | 'advertising_revenue'
  | 'sponsorship'
  | 'subscription'
  | 'membership'
  | 'royalty'
  | 'license_fee'
  | 'digital_download_sale'
  | 'course_sale'
  | 'marketplace_asset_sale'
  | 'service_fee'
  | 'consulting_fee'
  | 'training_fee'
  | 'freelance_fee'
  | 'revenue_share'
  | 'rental_income'
  | 'survey_or_microtask_reward'

export type SideHustleDefinition = {
  family: SideHustleFamily
  label: string
  hubCategory: OpportunityHubCategory
  defaultRole: SideHustleRole
  executionOwners: string[]
  monetizationModels: SideHustleMonetizationModel[]
}

export type SideHustleProfile = {
  family: SideHustleFamily
  role: SideHustleRole
  automationMaturity: SideHustleAutomationMaturity
  executionOwners: string[]
  monetizationModels: SideHustleMonetizationModel[]
}

export const SIDE_HUSTLE_DEFINITIONS: readonly SideHustleDefinition[] = [
  { family: 'ai_business_implementation', label: 'AI Business Implementation', hubCategory: 'ai_businesses', defaultRole: 'standalone', executionOwners: ['opportunity', 'growth', 'builder'], monetizationModels: ['consulting_fee', 'training_fee', 'service_fee'] },
  { family: 'business_automation', label: 'Business Automation', hubCategory: 'ai_businesses', defaultRole: 'standalone', executionOwners: ['opportunity', 'builder'], monetizationModels: ['service_fee', 'subscription'] },
  { family: 'business_systems', label: 'Business Systems Installation', hubCategory: 'ai_businesses', defaultRole: 'standalone', executionOwners: ['opportunity', 'builder'], monetizationModels: ['service_fee', 'consulting_fee', 'subscription'] },
  { family: 'lead_generation_growth', label: 'Lead Generation & Growth', hubCategory: 'ai_businesses', defaultRole: 'standalone', executionOwners: ['growth', 'opportunity'], monetizationModels: ['service_fee', 'revenue_share'] },
  { family: 'ai_discovery_seo', label: 'AI Discovery / SEO', hubCategory: 'ai_businesses', defaultRole: 'standalone', executionOwners: ['growth', 'opportunity'], monetizationModels: ['service_fee', 'subscription'] },
  { family: 'content_social', label: 'Content & Social Operations', hubCategory: 'freelance', defaultRole: 'standalone', executionOwners: ['growth', 'media'], monetizationModels: ['service_fee', 'freelance_fee'] },
  { family: 'creative_advertising', label: 'Creative / Advertising', hubCategory: 'freelance', defaultRole: 'add_on', executionOwners: ['growth', 'media'], monetizationModels: ['service_fee', 'freelance_fee', 'revenue_share'] },
  { family: 'media_production', label: 'Media Production', hubCategory: 'freelance', defaultRole: 'standalone', executionOwners: ['media'], monetizationModels: ['service_fee', 'freelance_fee', 'license_fee', 'marketplace_asset_sale'] },
  { family: 'owned_media', label: 'Owned Media', hubCategory: 'ai_businesses', defaultRole: 'standalone', executionOwners: ['media', 'growth'], monetizationModels: ['advertising_revenue', 'sponsorship', 'affiliate_commission', 'subscription'] },
  { family: 'creator_monetization', label: 'Creator Monetization', hubCategory: 'ai_businesses', defaultRole: 'standalone', executionOwners: ['growth', 'media', 'commerce'], monetizationModels: ['service_fee', 'revenue_share', 'sponsorship', 'subscription', 'membership'] },
  { family: 'digital_products', label: 'Digital Products', hubCategory: 'products', defaultRole: 'standalone', executionOwners: ['commerce', 'builder', 'media'], monetizationModels: ['digital_download_sale', 'course_sale', 'subscription'] },
  { family: 'software_apps', label: 'Software / Apps', hubCategory: 'products', defaultRole: 'standalone', executionOwners: ['builder', 'commerce'], monetizationModels: ['subscription', 'license_fee'] },
  { family: 'communities', label: 'Paid Communities', hubCategory: 'products', defaultRole: 'standalone', executionOwners: ['growth', 'commerce'], monetizationModels: ['membership', 'subscription'] },
  { family: 'pod_personalized_commerce', label: 'POD / Personalized Commerce', hubCategory: 'products', defaultRole: 'standalone', executionOwners: ['pupsonstuff', 'commerce'], monetizationModels: ['print_on_demand_margin'] },
  { family: 'commerce_affiliate', label: 'Commerce & Affiliate', hubCategory: 'products', defaultRole: 'add_on', executionOwners: ['growth', 'commerce'], monetizationModels: ['affiliate_commission', 'revenue_share'] },
  { family: 'dropshipping_product_commerce', label: 'Dropshipping / Product Commerce', hubCategory: 'products', defaultRole: 'standalone', executionOwners: ['commerce'], monetizationModels: ['fulfillment_margin', 'inventory_resale_margin'] },
  { family: 'drop_servicing', label: 'Drop Servicing', hubCategory: 'arbitrage', defaultRole: 'standalone', executionOwners: ['opportunity', 'growth'], monetizationModels: ['fulfillment_margin', 'service_fee'] },
  { family: 'directories_marketplaces', label: 'Directories / Marketplaces', hubCategory: 'products', defaultRole: 'standalone', executionOwners: ['growth', 'commerce'], monetizationModels: ['advertising_revenue', 'affiliate_commission', 'service_fee', 'subscription'] },
  { family: 'physical_asset_businesses', label: 'Physical Asset Businesses', hubCategory: 'assets', defaultRole: 'standalone', executionOwners: ['opportunity', 'commerce'], monetizationModels: ['rental_income', 'service_fee'] },
  { family: 'boring_business_services', label: 'Boring Business Services', hubCategory: 'freelance', defaultRole: 'standalone', executionOwners: ['opportunity', 'builder'], monetizationModels: ['service_fee', 'freelance_fee', 'subscription'] },
  { family: 'research_services', label: 'Research Services', hubCategory: 'freelance', defaultRole: 'standalone', executionOwners: ['opportunity', 'overage'], monetizationModels: ['service_fee', 'freelance_fee'] },
  { family: 'procurement_subcontracting', label: 'Procurement / Subcontracting', hubCategory: 'partnerships', defaultRole: 'standalone', executionOwners: ['opportunity', 'sam'], monetizationModels: ['service_fee', 'revenue_share', 'fulfillment_margin'] },
  { family: 'website_revenue_systems', label: 'Website Revenue Systems', hubCategory: 'ai_businesses', defaultRole: 'standalone', executionOwners: ['builder', 'growth'], monetizationModels: ['service_fee', 'subscription'] },
  { family: 'human_premium_services', label: 'Human Premium Services', hubCategory: 'freelance', defaultRole: 'standalone', executionOwners: ['opportunity'], monetizationModels: ['service_fee', 'freelance_fee'] },
  { family: 'trading_investing_intelligence', label: 'Trading / Investing Intelligence', hubCategory: 'experiments', defaultRole: 'capability', executionOwners: ['money'], monetizationModels: [] },
  { family: 'pr_authority', label: 'PR / Authority Building', hubCategory: 'ai_businesses', defaultRole: 'add_on', executionOwners: ['growth'], monetizationModels: ['service_fee'] },
]

export const SIDE_HUSTLE_FAMILY_IDS = SIDE_HUSTLE_DEFINITIONS.map((definition) => definition.family)

export function getSideHustleDefinition(family: SideHustleFamily): SideHustleDefinition {
  const definition = SIDE_HUSTLE_DEFINITIONS.find((candidate) => candidate.family === family)
  if (!definition) throw new Error(`Unknown side hustle family: ${family}`)
  return definition
}

export function buildSideHustleProfile(input: {
  family: SideHustleFamily
  role?: SideHustleRole
  automationMaturity?: SideHustleAutomationMaturity
  executionOwners?: string[]
  monetizationModels?: SideHustleMonetizationModel[]
}): SideHustleProfile {
  const definition = getSideHustleDefinition(input.family)
  return {
    family: input.family,
    role: input.role ?? definition.defaultRole,
    automationMaturity: input.automationMaturity ?? 'unvalidated',
    executionOwners: unique(input.executionOwners ?? definition.executionOwners),
    monetizationModels: [...new Set(input.monetizationModels ?? definition.monetizationModels)],
  }
}

export function isSideHustleProfile(value: unknown): value is SideHustleProfile {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return isSideHustleFamily(record.family) &&
    isSideHustleRole(record.role) &&
    isSideHustleAutomationMaturity(record.automationMaturity) &&
    isStringArray(record.executionOwners) &&
    Array.isArray(record.monetizationModels) &&
    record.monetizationModels.every(isSideHustleMonetizationModel)
}

export function isSideHustleFamily(value: unknown): value is SideHustleFamily {
  return typeof value === 'string' && SIDE_HUSTLE_FAMILY_IDS.includes(value as SideHustleFamily)
}

export function isSideHustleRole(value: unknown): value is SideHustleRole {
  return value === 'standalone' || value === 'add_on' || value === 'capability'
}

export function isSideHustleAutomationMaturity(value: unknown): value is SideHustleAutomationMaturity {
  return typeof value === 'string' && [
    'unvalidated',
    'human_delivered',
    'ai_assisted',
    'workflow_automated',
    'exception_managed',
    'autonomous_cell',
  ].includes(value)
}

export function isSideHustleMonetizationModel(value: unknown): value is SideHustleMonetizationModel {
  return typeof value === 'string' && [
    'affiliate_commission',
    'fulfillment_margin',
    'inventory_resale_margin',
    'print_on_demand_margin',
    'advertising_revenue',
    'sponsorship',
    'subscription',
    'membership',
    'royalty',
    'license_fee',
    'digital_download_sale',
    'course_sale',
    'marketplace_asset_sale',
    'service_fee',
    'consulting_fee',
    'training_fee',
    'freelance_fee',
    'revenue_share',
    'rental_income',
    'survey_or_microtask_reward',
  ].includes(value)
}

export type SideHustleScoreFactors = {
  demand: number
  pain: number
  abilityToPay: number
  distributionAccess: number
  domainAdvantage: number
  margin: number
  recurrence: number
  automationPotential: number
  reusableIp: number
  productizationPotential: number
  evidence: number
  processMaturity: number
  knowledgeAvailability: number
  adoptionFeasibility: number
  roiObservability: number
  timeToEvidence: number
  customerAcquisitionCost: number
  humanAttention: number
  capitalRisk: number
  competition: number
  regulation: number
  platformDependency: number
  failureCost: number
  fulfillmentComplexity: number
}

export type SideHustleScore = {
  overall: number
  factors: SideHustleScoreFactors
  reasons: string[]
}

const POSITIVE_WEIGHTS: Record<keyof Pick<SideHustleScoreFactors,
  | 'demand' | 'pain' | 'abilityToPay' | 'distributionAccess' | 'domainAdvantage'
  | 'margin' | 'recurrence' | 'automationPotential' | 'reusableIp' | 'productizationPotential'
  | 'evidence' | 'processMaturity' | 'knowledgeAvailability' | 'adoptionFeasibility' | 'roiObservability'
>, number> = {
  demand: 0.09,
  pain: 0.08,
  abilityToPay: 0.07,
  distributionAccess: 0.08,
  domainAdvantage: 0.07,
  margin: 0.07,
  recurrence: 0.07,
  automationPotential: 0.07,
  reusableIp: 0.05,
  productizationPotential: 0.05,
  evidence: 0.08,
  processMaturity: 0.04,
  knowledgeAvailability: 0.03,
  adoptionFeasibility: 0.03,
  roiObservability: 0.02,
}

const PENALTY_WEIGHTS: Record<keyof Pick<SideHustleScoreFactors,
  | 'timeToEvidence' | 'customerAcquisitionCost' | 'humanAttention' | 'capitalRisk'
  | 'competition' | 'regulation' | 'platformDependency' | 'failureCost' | 'fulfillmentComplexity'
>, number> = {
  timeToEvidence: 0.02,
  customerAcquisitionCost: 0.015,
  humanAttention: 0.015,
  capitalRisk: 0.015,
  competition: 0.01,
  regulation: 0.01,
  platformDependency: 0.005,
  failureCost: 0.005,
  fulfillmentComplexity: 0.005,
}

export function scoreSideHustle(factors: SideHustleScoreFactors): SideHustleScore {
  validateScoreFactors(factors)
  let overall = 0
  for (const [key, weight] of Object.entries(POSITIVE_WEIGHTS) as [keyof SideHustleScoreFactors, number][]) {
    overall += factors[key] * weight
  }
  for (const [key, weight] of Object.entries(PENALTY_WEIGHTS) as [keyof SideHustleScoreFactors, number][]) {
    overall += (100 - factors[key]) * weight
  }

  return {
    overall: Math.round(overall * 100) / 100,
    factors: { ...factors },
    reasons: [
      `demand=${factors.demand}`,
      `pain=${factors.pain}`,
      `distribution=${factors.distributionAccess}`,
      `domain_advantage=${factors.domainAdvantage}`,
      `evidence=${factors.evidence}`,
      `time_to_evidence_penalty=${factors.timeToEvidence}`,
      `capital_risk_penalty=${factors.capitalRisk}`,
      `failure_cost_penalty=${factors.failureCost}`,
    ],
  }
}

function validateScoreFactors(factors: SideHustleScoreFactors): void {
  for (const [key, value] of Object.entries(factors)) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`Side hustle score factor ${key} must be between 0 and 100`)
    }
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0)
}
