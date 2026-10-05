import type { SideHustleFamily } from './side-hustles.js'

export type SearchCommerceFunnelStage =
  | 'evidence_insufficient'
  | 'no_observed_discovery'
  | 'impressions_without_visits'
  | 'visits_without_orders'
  | 'orders_observed'

export type SearchCommerceCatalogObservation = {
  listingCount: number
  listingsByProductType: Readonly<Record<string, number>>
}

export type SearchCommerceTrafficObservation = {
  impressions?: number
  visits?: number
  orders?: number
}

export type SearchCommerceStorefrontObservation = {
  family: SideHustleFamily
  observedAt: string
  catalog: SearchCommerceCatalogObservation
  traffic: SearchCommerceTrafficObservation
  reviewCount?: number
  averageRating?: number
  professionalPrimaryImageCoverage?: number
  listingVideoCoverage?: number
  personalizationCoverage?: number
  policiesConfigured?: boolean
  faqConfigured?: boolean
  aboutConfigured?: boolean
  shopSectionsConfigured?: boolean
  socialsLinked?: boolean
  saleActive?: boolean
  salePercent?: number
  domesticShippingAmount?: number
  currency?: string
  freeShippingThreshold?: number
  evidenceRefs: readonly string[]
}

export type SearchCommerceCatalogFacts = {
  listingCount: number
  productTypeCount: number
  dominantProductType?: string
  dominantProductTypeListings: number
  dominantProductTypeShare?: number
  singletonProductTypeCount: number
}

export type SearchCommerceStorefrontDiagnostic = {
  family: SideHustleFamily
  observedAt: string
  funnelStage: SearchCommerceFunnelStage
  catalog: SearchCommerceCatalogFacts
  observations: readonly string[]
  experimentCandidates: readonly string[]
  evidenceRefs: readonly string[]
  authority: 'SEARCH_COMMERCE_STOREFRONT_DIAGNOSTICS_ONLY'
  externalActionAuthorized: false
  publishingAuthorized: false
  promotionAuthorized: false
  purchasingAuthorized: false
  moneyMovementAuthorized: false
}

export type SearchCommerceBenchmarkMetric = {
  id: string
  label: string
  value: number
  unit: 'share' | 'count' | 'median'
  population: string
  interpretation: 'descriptive_only'
}

export type SearchCommerceBenchmarkSnapshot = {
  id: string
  sourceLabel: string
  cohort: string
  metrics: readonly SearchCommerceBenchmarkMetric[]
  caveats: readonly string[]
  authority: 'SOURCE_BENCHMARK_ONLY'
  causalAuthority: false
}

const SUPPORTED_FAMILIES: readonly SideHustleFamily[] = Object.freeze([
  'pod_personalized_commerce',
  'commerce_affiliate',
  'digital_products',
  'owned_media',
])

/**
 * Descriptive observations reported in the user-supplied transcript studying
 * 100 Etsy shops with 100,000+ lifetime sales. These are cohort observations,
 * not causal requirements, platform rules, or success thresholds.
 */
export const ETSY_100K_SELLER_SOURCE_BENCHMARK: SearchCommerceBenchmarkSnapshot =
  Object.freeze({
    id: 'etsy-100k-seller-source-benchmark-v1',
    sourceLabel: 'User-supplied 100-shop Etsy seller study transcript',
    cohort: '100 Etsy shops reported to have at least 100,000 lifetime sales',
    metrics: Object.freeze([
      metric('sale_active', 'shops running a sale', 0.93, 'share'),
      metric('sale_25_plus', 'shops running a sale of at least 25%', 0.84, 'share'),
      metric('sale_whole_shop', 'shops applying sale to entire shop', 0.78, 'share'),
      metric('shipping_charged', 'shops charging for shipping', 0.81, 'share'),
      metric('shipping_under_6', 'shops charging less than $6 shipping', 0.67, 'share'),
      metric('free_shipping_35', 'shops offering free shipping over $35', 0.54, 'share'),
      metric('professional_photos', 'shops with professional mockups or product photos', 0.91, 'share'),
      metric('multiple_product_types', 'shops offering at least two product types', 0.97, 'share'),
      metric('five_plus_product_types', 'shops offering more than five product types', 0.85, 'share'),
      metric('listing_500_plus', 'shops with more than 500 listings', 0.74, 'share'),
      metric('listing_1000_plus', 'shops with more than 1,000 listings', 0.60, 'share'),
      metric('listing_2000_plus', 'shops with more than 2,000 listings', 0.29, 'share'),
      metric('listing_count_median', 'median listing count', 1611, 'median'),
      metric('title_130_plus', 'best-selling listings using at least 130 title characters', 0.74, 'share'),
      metric('all_13_tags', 'best-selling listings using all 13 tags', 0.96, 'share'),
      metric('personalized_best_seller', 'best-selling listings with personalization/customization', 0.66, 'share'),
      metric('all_10_images', 'best-selling listings using all 10 listing images', 0.48, 'share'),
      metric('size_chart', 'shops whose studied listing included a size chart', 0.91, 'share'),
      metric('additional_info_images', 'shops whose studied listing included additional information imagery', 0.80, 'share'),
      metric('listing_video', 'studied listings containing video', 0.49, 'share'),
      metric('thorough_description', 'shops with a thorough product description', 0.96, 'share'),
      metric('shop_banner', 'shops with a shop banner', 0.96, 'share'),
      metric('promotional_banner', 'shops using banner to promote more than name/product imagery', 0.35, 'share'),
      metric('shop_sections', 'shops with organized shop sections', 0.98, 'share'),
      metric('about_section', 'shops with an about section', 0.73, 'share'),
      metric('socials_linked', 'shops linking social accounts and/or website', 0.51, 'share'),
      metric('policies_filled', 'shops with shop policies filled out', 0.97, 'share'),
      metric('faq_present', 'shops with FAQs', 0.54, 'share'),
    ]),
    caveats: Object.freeze([
      'The cohort is selected on already having at least 100,000 lifetime sales, so the observations are subject to survivorship and selection bias.',
      'The transcript does not establish that any observed practice caused the shops to reach 100,000 sales.',
      'Marketplace behavior, search rules, fees, and UI can change; platform-sensitive claims require current official verification before becoming policy.',
      'Third-party tools mentioned in the source are research aids, not canonical transaction or platform truth.',
    ]),
    authority: 'SOURCE_BENCHMARK_ONLY',
    causalAuthority: false,
  })

export function diagnoseSearchCommerceStorefront(
  input: SearchCommerceStorefrontObservation,
): SearchCommerceStorefrontDiagnostic {
  assertSupportedFamily(input.family)
  const observedAt = normalizeDate(input.observedAt)
  const evidenceRefs = unique(input.evidenceRefs)
  if (evidenceRefs.length === 0) {
    throw new Error('Search Commerce storefront diagnostic requires evidence references')
  }

  const catalog = catalogFacts(input.catalog)
  const funnelStage = deriveFunnelStage(input.traffic)
  const observations: string[] = []
  const experimentCandidates: string[] = []

  observations.push(
    `${catalog.listingCount} listings across ${catalog.productTypeCount} observed product types.`,
  )
  if (catalog.dominantProductType) {
    observations.push(
      `Largest observed product type is ${catalog.dominantProductType} with ${catalog.dominantProductTypeListings} listings (${percent(catalog.dominantProductTypeShare ?? 0)} of catalog).`,
    )
  }
  if (catalog.singletonProductTypeCount > 0) {
    observations.push(
      `${catalog.singletonProductTypeCount} product types have only one observed listing; this is a coverage fact, not proof that those products cannot sell.`,
    )
  }

  switch (funnelStage) {
    case 'evidence_insufficient':
      observations.push('Traffic evidence is incomplete, so the system cannot locate the primary funnel break.')
      experimentCandidates.push('Collect impressions, visits, and orders for the same observation window before diagnosing ranking or conversion.')
      break
    case 'no_observed_discovery':
      observations.push('No impressions were observed in the supplied window.')
      experimentCandidates.push('Investigate query demand, indexing/discovery, niche fit, and catalog coverage before changing conversion assets.')
      break
    case 'impressions_without_visits':
      observations.push('Impressions were observed but visits were zero.')
      experimentCandidates.push('Test query-to-listing relevance, primary image/thumbnail, title, and offer presentation with attributable variants.')
      break
    case 'visits_without_orders':
      observations.push('Visits were observed but orders were zero.')
      experimentCandidates.push('Test product/offer fit, trust, pricing, shipping, listing information, personalization, and creative presentation.')
      break
    case 'orders_observed':
      observations.push('Orders were observed in the supplied window.')
      experimentCandidates.push('Segment winners by product type, query, creative, offer, and realized contribution before expanding.')
      break
  }

  if (catalog.productTypeCount > 1 && catalog.dominantProductTypeShare !== undefined) {
    experimentCandidates.push(
      'Compare a focus-first catalog experiment against broader product diversification; do not assume either strategy is universally superior.',
    )
  }

  if (input.professionalPrimaryImageCoverage !== undefined) {
    observations.push(`Professional primary-image coverage: ${percent(requireRate(input.professionalPrimaryImageCoverage, 'professionalPrimaryImageCoverage'))}.`)
  }
  if (input.listingVideoCoverage !== undefined) {
    observations.push(`Listing-video coverage: ${percent(requireRate(input.listingVideoCoverage, 'listingVideoCoverage'))}.`)
  }
  if (input.personalizationCoverage !== undefined) {
    observations.push(`Personalization coverage: ${percent(requireRate(input.personalizationCoverage, 'personalizationCoverage'))}.`)
  }

  if (input.saleActive) {
    const suffix = input.salePercent === undefined ? '' : ` at ${requireNonNegative(input.salePercent, 'salePercent')}%`
    observations.push(`A sale was observed${suffix}; its causal effect is not inferred.`)
  }
  if (input.domesticShippingAmount !== undefined) {
    const amount = requireNonNegative(input.domesticShippingAmount, 'domesticShippingAmount')
    const currency = input.currency?.trim().toUpperCase() || 'UNKNOWN'
    observations.push(`Observed domestic shipping amount: ${amount.toFixed(2)} ${currency}; current marketplace treatment requires separate verification.`)
  }

  for (const [label, value] of [
    ['policies configured', input.policiesConfigured],
    ['FAQ configured', input.faqConfigured],
    ['about section configured', input.aboutConfigured],
    ['shop sections configured', input.shopSectionsConfigured],
    ['socials linked', input.socialsLinked],
  ] as const) {
    if (value !== undefined) observations.push(`${label}: ${value ? 'yes' : 'no'}.`)
  }

  return Object.freeze({
    family: input.family,
    observedAt,
    funnelStage,
    catalog,
    observations: Object.freeze(observations),
    experimentCandidates: Object.freeze(unique(experimentCandidates)),
    evidenceRefs: Object.freeze(evidenceRefs),
    authority: 'SEARCH_COMMERCE_STOREFRONT_DIAGNOSTICS_ONLY',
    externalActionAuthorized: false,
    publishingAuthorized: false,
    promotionAuthorized: false,
    purchasingAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

function catalogFacts(input: SearchCommerceCatalogObservation): SearchCommerceCatalogFacts {
  if (!Number.isInteger(input.listingCount) || input.listingCount < 0) {
    throw new Error('listingCount must be a non-negative integer')
  }

  const entries = Object.entries(input.listingsByProductType)
  let sum = 0
  let dominantProductType: string | undefined
  let dominantProductTypeListings = 0
  let singletonProductTypeCount = 0

  for (const [rawName, count] of entries) {
    const name = rawName.trim()
    if (!name) throw new Error('product type names must be non-empty')
    if (!Number.isInteger(count) || count < 0) {
      throw new Error('product type listing counts must be non-negative integers')
    }
    sum += count
    if (count === 1) singletonProductTypeCount += 1
    if (count > dominantProductTypeListings) {
      dominantProductType = name
      dominantProductTypeListings = count
    }
  }

  if (sum !== input.listingCount) {
    throw new Error('product type listing counts must sum to listingCount')
  }

  return Object.freeze({
    listingCount: input.listingCount,
    productTypeCount: entries.filter(([, count]) => count > 0).length,
    dominantProductType,
    dominantProductTypeListings,
    dominantProductTypeShare:
      input.listingCount > 0 ? round(dominantProductTypeListings / input.listingCount) : undefined,
    singletonProductTypeCount,
  })
}

function deriveFunnelStage(input: SearchCommerceTrafficObservation): SearchCommerceFunnelStage {
  const impressions = optionalCount(input.impressions, 'impressions')
  const visits = optionalCount(input.visits, 'visits')
  const orders = optionalCount(input.orders, 'orders')

  if (impressions === undefined || visits === undefined || orders === undefined) {
    return 'evidence_insufficient'
  }
  if (impressions === 0) return 'no_observed_discovery'
  if (visits === 0) return 'impressions_without_visits'
  if (orders === 0) return 'visits_without_orders'
  return 'orders_observed'
}

function metric(
  id: string,
  label: string,
  value: number,
  unit: SearchCommerceBenchmarkMetric['unit'],
): SearchCommerceBenchmarkMetric {
  return Object.freeze({
    id,
    label,
    value,
    unit,
    population: 'reported 100-shop Etsy 100k+ sales cohort',
    interpretation: 'descriptive_only',
  })
}

function assertSupportedFamily(family: SideHustleFamily): void {
  if (!SUPPORTED_FAMILIES.includes(family)) {
    throw new Error(`Search Commerce storefront diagnostic is not registered for side hustle family ${family}`)
  }
}

function normalizeDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error('observedAt must be a valid date')
  return new Date(parsed).toISOString()
}

function optionalCount(value: number | undefined, field: string): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`)
  }
  return value
}

function requireRate(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${field} must be between 0 and 1`)
  }
  return value
}

function requireNonNegative(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be non-negative`)
  }
  return value
}

function percent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
