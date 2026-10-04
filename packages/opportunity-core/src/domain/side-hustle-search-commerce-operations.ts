import type { SideHustleFamily } from './side-hustles.js'

export type SearchCommerceCadence = 'daily' | 'weekly' | 'monthly'

export const SEARCH_COMMERCE_ROUTINE_IDS = [
  'daily_shop_health',
  'daily_customer_service',
  'daily_order_operations',
  'weekly_listing_inventory',
  'weekly_conversion_experiments',
  'weekly_market_research',
  'monthly_shop_audit',
  'monthly_operating_plan',
  'monthly_financial_review',
] as const

export type SearchCommerceRoutineId = (typeof SEARCH_COMMERCE_ROUTINE_IDS)[number]

export const SEARCH_COMMERCE_EVIDENCE_KEYS = [
  'orders',
  'messages',
  'listing-health observations',
  'provider alerts',
  'open cases',
  'policy context',
  'fulfillment observations',
  'shipping observations',
  'provider exceptions',
  'search demand',
  'product candidates',
  'current listing inventory',
  'seasonal runway',
  'impressions',
  'clicks',
  'visits',
  'conversion',
  'current creative/listing state',
  'market observations',
  'search observations',
  'competitor observations',
  'trend observations',
  'brand state',
  'listings',
  'creative assets',
  'pricing',
  'policies',
  'performance observations',
  'demand windows',
  'inventory roadmap',
  'experiment results',
  'capacity',
  'revenue',
  'product costs',
  'shipping',
  'fees',
  'refunds/reversals',
  'ad spend',
  'provider costs',
  'expected unit economics',
  'expected product costs',
  'expected shipping',
  'expected platform fees',
  'expected provider costs',
] as const

export type SearchCommerceEvidenceKey = (typeof SEARCH_COMMERCE_EVIDENCE_KEYS)[number]

export type SearchCommerceSourceClaimStatus =
  | 'source_claim'
  | 'official_verification_pending'
  | 'experiment_only'
  | 'measured_local_result'

export type SearchCommerceSourceClaim = {
  id: string
  claim: string
  status: SearchCommerceSourceClaimStatus
  policy: string
}

export type SearchCommerceRoutine = {
  id: SearchCommerceRoutineId
  cadence: SearchCommerceCadence
  objective: string
  requiredInputs: readonly SearchCommerceEvidenceKey[]
  produces: readonly string[]
  applicableFamilies: readonly SideHustleFamily[]
  mayTriggerExperiment: boolean
  externalActionAuthorized: false
  moneyMovementAuthorized: false
}

export type SearchCommerceOperatingPlan = {
  family: SideHustleFamily
  generatedAt: string
  routines: readonly SearchCommerceRoutine[]
  sourceClaims: readonly SearchCommerceSourceClaim[]
  authority: 'SEARCH_COMMERCE_OPERATIONS_PLANNING_ONLY'
  externalActionAuthorized: false
  publishingAuthorized: false
  purchasingAuthorized: false
  moneyMovementAuthorized: false
}

export const SEARCH_COMMERCE_FAMILIES: readonly SideHustleFamily[] = Object.freeze([
  'pod_personalized_commerce',
  'commerce_affiliate',
  'digital_products',
  'owned_media',
])

export const SEARCH_COMMERCE_SOURCE_CLAIMS: readonly SearchCommerceSourceClaim[] = Object.freeze([
  {
    id: 'etsy_daily_activity_visibility',
    claim: 'Daily shop activity improves Etsy search visibility.',
    status: 'official_verification_pending',
    policy: 'Do not score or rank a shop higher merely because an operator opened or touched it. Measure outcome effects locally before promotion.',
  },
  {
    id: 'etsy_fresh_listing_visibility',
    claim: 'Publishing fresh listings improves Etsy search placement.',
    status: 'official_verification_pending',
    policy: 'Treat publishing cadence as an experiment variable; never infer search benefit without measured impressions, clicks, and conversion observations.',
  },
  {
    id: 'etsy_small_tweaks_visibility',
    claim: 'Frequent listing edits improve Etsy visibility.',
    status: 'experiment_only',
    policy: 'Change one material variable at a time where practical and preserve before/after evidence so the system can learn rather than churn listings blindly.',
  },
])

export const SEARCH_COMMERCE_OPERATING_ROUTINES: readonly SearchCommerceRoutine[] = Object.freeze([
  routine(
    'daily_shop_health',
    'daily',
    'Review shop health and surface operational exceptions before they become customer or fulfillment failures.',
    ['orders', 'messages', 'listing-health observations', 'provider alerts'],
    ['shop-health observation', 'exception queue'],
    false,
  ),
  routine(
    'daily_customer_service',
    'daily',
    'Review customer messages and unresolved service issues using the owning customer-service boundary.',
    ['messages', 'open cases', 'policy context'],
    ['service-priority queue', 'response/review requirement'],
    false,
  ),
  routine(
    'daily_order_operations',
    'daily',
    'Reconcile new and in-flight orders, fulfillment state, shipping risk, and provider exceptions.',
    ['orders', 'fulfillment observations', 'shipping observations', 'provider exceptions'],
    ['order exception queue', 'fulfillment reconciliation evidence'],
    false,
  ),
  routine(
    'weekly_listing_inventory',
    'weekly',
    'Review product/listing coverage and propose evidence-backed additions instead of treating listing count as a vanity target.',
    ['search demand', 'product candidates', 'current listing inventory', 'seasonal runway'],
    ['listing opportunity queue', 'coverage gaps'],
    true,
  ),
  routine(
    'weekly_conversion_experiments',
    'weekly',
    'Select bounded listing or creative experiments such as thumbnail, title, offer, or promotion tests.',
    ['impressions', 'clicks', 'visits', 'conversion', 'current creative/listing state'],
    ['experiment proposal', 'control/variant lineage'],
    true,
  ),
  routine(
    'weekly_market_research',
    'weekly',
    'Refresh competitor, keyword, trend, seasonality, pricing, and buyer-intent evidence.',
    ['market observations', 'search observations', 'competitor observations', 'trend observations'],
    ['demand signals', 'Product Sniper evidence', 'seasonal opportunities'],
    false,
  ),
  routine(
    'monthly_shop_audit',
    'monthly',
    'Audit the buyer-facing storefront for stale, inconsistent, underperforming, or policy-risk content.',
    ['brand state', 'listings', 'creative assets', 'pricing', 'policies', 'performance observations'],
    ['audit findings', 'prioritized repair queue'],
    true,
  ),
  routine(
    'monthly_operating_plan',
    'monthly',
    'Turn observed demand and business constraints into the next month\'s launch, listing, creative, and marketing plan.',
    ['demand windows', 'inventory roadmap', 'experiment results', 'capacity', 'seasonal runway'],
    ['monthly operating plan', 'deadlines', 'publish-by targets'],
    false,
  ),
  routine(
    'monthly_financial_review',
    'monthly',
    'Review realized unit economics rather than gross sales alone.',
    ['revenue', 'product costs', 'shipping', 'fees', 'refunds/reversals', 'ad spend', 'provider costs'],
    ['margin observations', 'pricing review queue', 'profitability evidence'],
    true,
  ),
])

export function buildSearchCommerceOperatingPlan(input: {
  family: SideHustleFamily
  generatedAt?: string
  enabledRoutineIds?: readonly SearchCommerceRoutineId[]
}): SearchCommerceOperatingPlan {
  if (!SEARCH_COMMERCE_FAMILIES.includes(input.family)) {
    throw new Error(`Search Commerce cadence is not registered for side hustle family ${input.family}`)
  }

  const generatedAt = normalizeDate(input.generatedAt ?? new Date().toISOString())
  const enabled = input.enabledRoutineIds
    ? new Set(input.enabledRoutineIds)
    : undefined

  const routines = SEARCH_COMMERCE_OPERATING_ROUTINES.filter((item) =>
    item.applicableFamilies.includes(input.family) &&
    (!enabled || enabled.has(item.id)),
  )

  return Object.freeze({
    family: input.family,
    generatedAt,
    routines: Object.freeze([...routines]),
    sourceClaims: SEARCH_COMMERCE_SOURCE_CLAIMS,
    authority: 'SEARCH_COMMERCE_OPERATIONS_PLANNING_ONLY',
    externalActionAuthorized: false,
    publishingAuthorized: false,
    purchasingAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

export function routinesForCadence(
  plan: SearchCommerceOperatingPlan,
  cadence: SearchCommerceCadence,
): readonly SearchCommerceRoutine[] {
  return plan.routines.filter((routine) => routine.cadence === cadence)
}

function routine(
  id: SearchCommerceRoutineId,
  cadence: SearchCommerceCadence,
  objective: string,
  requiredInputs: readonly SearchCommerceEvidenceKey[],
  produces: readonly string[],
  mayTriggerExperiment: boolean,
): SearchCommerceRoutine {
  return Object.freeze({
    id,
    cadence,
    objective,
    requiredInputs: Object.freeze([...requiredInputs]),
    produces: Object.freeze([...produces]),
    applicableFamilies: SEARCH_COMMERCE_FAMILIES,
    mayTriggerExperiment,
    externalActionAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

function normalizeDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) {
    throw new Error('Search Commerce operating plan generatedAt must be a valid date')
  }
  return new Date(parsed).toISOString()
}


export function isSearchCommerceFamily(family: SideHustleFamily): boolean {
  return SEARCH_COMMERCE_FAMILIES.includes(family)
}
