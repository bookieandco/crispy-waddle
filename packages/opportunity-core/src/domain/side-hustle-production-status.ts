import {
  SIDE_HUSTLE_DEFINITIONS,
  type SideHustleFamily,
} from './side-hustles.js'

export type SideHustleProductionReadiness =
  | 'validation_ready'
  | 'execution_spine'
  | 'adapter_ready'
  | 'live_candidate'
  | 'capability_only'

export type SideHustleProductionStatus = {
  family: SideHustleFamily
  readiness: SideHustleProductionReadiness
  summary: string
  evidenceRefs: readonly string[]
  blockers: readonly string[]
  nextMilestones: readonly string[]
  liveCommercialEvidenceRequired: boolean
  externalActionAuthorized: false
  moneyMovementAuthorized: false
}

const SHARED = [
  'packages/opportunity-core/src/domain/side-hustles.ts',
  'packages/opportunity-core/src/domain/side-hustle-lab.ts',
  'apps/jhadina-web/src/lib/opportunities/side-hustle-lab-runtime.ts',
] as const

function status(
  family: SideHustleFamily,
  readiness: SideHustleProductionReadiness,
  summary: string,
  evidenceRefs: readonly string[],
  blockers: readonly string[],
  nextMilestones: readonly string[],
  liveCommercialEvidenceRequired = true,
): SideHustleProductionStatus {
  return Object.freeze({
    family,
    readiness,
    summary,
    evidenceRefs: Object.freeze([...new Set([...SHARED, ...evidenceRefs])]),
    blockers: Object.freeze([...blockers]),
    nextMilestones: Object.freeze([...nextMilestones]),
    liveCommercialEvidenceRequired,
    externalActionAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

export const SIDE_HUSTLE_PRODUCTION_STATUS: Readonly<Record<SideHustleFamily, SideHustleProductionStatus>> = Object.freeze({
  ai_business_implementation: status(
    'ai_business_implementation',
    'validation_ready',
    'Commercial discovery, proof-sprint, CRM, and bounded-validation machinery exist; a dedicated implementation-delivery runtime is not yet certified.',
    [
      'packages/opportunity-core/src/domain/commercial-learning.ts',
      'packages/opportunity-core/src/domain/side-hustle-relationships.ts',
    ],
    ['No dedicated implementation project/delivery runtime is bound as a certified execution owner.'],
    [
      'Define the canonical client implementation work package and delivery receipt.',
      'Bind approved implementation work to the appropriate Builder/Growth executor.',
      'Run one paid pilot through outcome learning and maturity assessment.',
    ],
  ),

  business_automation: status(
    'business_automation',
    'validation_ready',
    'The Business Factory can identify and validate automation work, but the generic customer-workflow installation runtime is not yet a certified delivery path.',
    [
      'packages/opportunity-core/src/domain/commercial-learning.ts',
      'docs/architecture/CREATOR-COMMERCIAL-TRANSCRIPT-FOLD-2026-09-28.md',
    ],
    ['No generic client automation deployment/acceptance receipt exists for this family.'],
    [
      'Create a bounded workflow-audit-to-automation delivery contract.',
      'Bind deployment, rollback, and acceptance evidence to the owning executor.',
      'Certify one real customer workflow from baseline through measured ROI.',
    ],
  ),

  business_systems: status(
    'business_systems',
    'validation_ready',
    'Research, commercial learning, and relationship context exist; repeatable systems-installation delivery still needs a canonical implementation runtime.',
    [
      'packages/opportunity-core/src/domain/commercial-learning.ts',
      'docs/SH_BUSINESS_FACTORY_PORTFOLIO_2026-09-22.md',
    ],
    ['No dedicated systems-installation checklist, deployment receipt, and acceptance loop are certified.'],
    [
      'Define system-installation templates and acceptance criteria.',
      'Connect customer requirements to Builder/connector execution plans.',
      'Capture before/after operating metrics and a realized paid outcome.',
    ],
  ),

  lead_generation_growth: status(
    'lead_generation_growth',
    'execution_spine',
    'Growth intelligence, CRM relationship lanes, prospect research, attribution, and governed outreach boundaries provide a real execution spine.',
    [
      'packages/opportunity-core/src/domain/commercial-learning.ts',
      'packages/opportunity-core/src/domain/side-hustle-relationships.ts',
      'docs/SOCIAL_MEDIA_MARKETING_BEAST_AUDIT_2026-09-22.md',
      'apps/jhadina-web/src/lib/relationships/sam-event-bridge.ts',
    ],
    ['Authorized outbound provider coverage and side-hustle-specific lead-delivery SLA evidence remain incomplete.'],
    [
      'Bind an authorized outreach provider to the existing governed outbox.',
      'Persist lead qualification and customer handoff receipts.',
      'Prove one paid lead-generation engagement with attribution to customer outcome.',
    ],
  ),

  ai_discovery_seo: status(
    'ai_discovery_seo',
    'execution_spine',
    'Growth owns durable presence/AEO strategy and the repo has an initial owned-web discovery implementation, but generalized customer-site execution is not yet certified.',
    [
      'packages/growth-core/src/intelligence/marketing-presence.ts',
      'docs/architecture/SOCIAL-PRESENCE-FOLD-2026-09-29.md',
      'apps/pupsonstuff/app/llms.txt/route.ts',
    ],
    ['The owned-web adapter is not yet generalized across arbitrary customer sites and measured search/AI discovery outcomes.'],
    [
      'Generalize llms.txt/agents/sitemap discovery adapters beyond PupsonStuff.',
      'Add query/citation/traffic observation ingestion.',
      'Run a paid customer SEO/AEO pilot with measurable discovery and conversion evidence.',
    ],
  ),

  content_social: status(
    'content_social',
    'execution_spine',
    'Growth, Social, Director, approval-bound publishing, durable outbox, and attribution form a governed content-operations execution spine.',
    [
      'docs/SOCIAL_MEDIA_MARKETING_BEAST_AUDIT_2026-09-22.md',
      'packages/social-core/src/automation.ts',
      'apps/jhadina-web/src/lib/social/growth-content-bridge.ts',
    ],
    ['At least one fully authorized production social provider still needs side-hustle-specific live service certification and customer outcome evidence.'],
    [
      'Certify one provider-backed scheduled publishing canary for a paying client/owned business.',
      'Bind provider-native analytics into Growth observations.',
      'Measure content output against qualified leads, sales, or another agreed customer outcome.',
    ],
  ),

  creative_advertising: status(
    'creative_advertising',
    'execution_spine',
    'Director commercial creative plus Growth paid-media control and attribution provide a governed production/advertising spine.',
    [
      'apps/jhadina-web/src/app/api/director/commercial/creative/route.ts',
      'apps/jhadina-web/src/app/api/growth/ads/campaigns/route.ts',
      'docs/SOCIAL_MEDIA_MARKETING_BEAST_AUDIT_2026-09-22.md',
    ],
    ['A side-hustle service package still needs end-to-end paid customer creative/ad performance certification.'],
    [
      'Package the creative audit -> production -> campaign measurement service.',
      'Bind exact creative variants to campaign/outcome receipts.',
      'Complete one paid engagement with contribution-economics evidence.',
    ],
  ),

  media_production: status(
    'media_production',
    'live_candidate',
    'Director has substantial governed production, review, generation, and live-certification infrastructure; the remaining gap is commercial service evidence rather than a missing production spine.',
    [
      'apps/jhadina-web/src/app/api/director/production-final/route.ts',
      '.github/workflows/media-production-certification.yml',
      'services/director-hunyuan/worker.py',
    ],
    ['No Side Hustle commercial receipt yet proves a real customer paid for and accepted a completed media job.'],
    [
      'Define media-service quote/SLA/acceptance contracts.',
      'Run one bounded paid production job through Director review and delivery.',
      'Record realized revenue, costs, hours, customer acceptance, and reuse lessons.',
    ],
  ),

  owned_media: status(
    'owned_media',
    'validation_ready',
    'Faceless/owned-media niche, topic, packaging, and monetization intelligence exist, but current channel analytics/publishing authority is not bound into a live owned-media loop.',
    [
      'docs/SH_FACELESS_YOUTUBE_CHANNEL_INTELLIGENCE_2026-09-25.md',
      'packages/shotlist-core/src/youtube-channel-intelligence.ts',
    ],
    ['No certified live YouTube analytics connector or owned-media publishing loop is claimed by the current implementation.'],
    [
      'Bind first-party channel analytics and revenue observations.',
      'Connect Shotlist -> Director -> governed publish for one owned channel.',
      'Run a 10-video evidence cycle before automating format selection or scaling.',
    ],
  ),

  creator_monetization: status(
    'creator_monetization',
    'execution_spine',
    'Growth, Social, Director, Commerce, creator relationship lanes, and attribution cover most execution primitives, but they are not yet certified as one creator-monetization operating loop.',
    [
      'packages/growth-core/src/intelligence/creator-operating-system.ts',
      'docs/architecture/CREATOR-COMMERCIAL-TRANSCRIPT-FOLD-2026-09-28.md',
      'docs/SOCIAL_MEDIA_MARKETING_BEAST_AUDIT_2026-09-22.md',
    ],
    ['Sponsor/affiliate/product/member revenue receipts are not yet unified into a family-level commercial certification.'],
    [
      'Create the canonical creator revenue-plan/runtime projection.',
      'Bind sponsor, affiliate, product, and membership outcomes to one creator identity.',
      'Prove repeat monetization from at least one creator property.',
    ],
  ),

  digital_products: status(
    'digital_products',
    'validation_ready',
    'The Business Factory can validate product demand and Growth/Commerce can market offers, but generalized digital delivery, entitlement, and refund handling are not yet certified.',
    [
      'docs/SH_AWESOME_PASSIVE_INCOME_REFERENCE_AUDIT_2026-09-21.md',
      'packages/opportunity-core/src/domain/side-hustle-experiment-proposal.ts',
    ],
    ['No generic digital-file/course entitlement and delivery runtime is certified.'],
    [
      'Build digital product catalog, entitlement, delivery, and refund receipts.',
      'Connect checkout/payment truth without creating a second ledger.',
      'Validate one product with paid orders and support/refund observations.',
    ],
  ),

  software_apps: status(
    'software_apps',
    'validation_ready',
    'Software opportunities and commitment experiments are modeled, but the registered Builder owner does not yet expose a canonical Side Hustle prototype-to-deployment runtime in this repo.',
    [
      'docs/VENTURE_FACTORY_2026-10-01.md',
      'packages/opportunity-core/src/domain/side-hustle-experiment-proposal.ts',
    ],
    ['No canonical Builder deployment/hosting/subscription handoff is certified for software Side Hustles.'],
    [
      'Define Builder prototype, deployment, rollback, and ownership receipts.',
      'Bind app hosting/domain/subscription execution through governed providers.',
      'Run one paid software commitment from concierge prototype to deployed product.',
    ],
  ),

  communities: status(
    'communities',
    'validation_ready',
    'Recurring-value evidence gates and customer/partner relationship lanes exist, but membership, access, moderation, and renewal execution are not yet bound.',
    [
      'packages/opportunity-core/src/domain/commercial-learning.ts',
      'packages/opportunity-core/src/domain/side-hustle-relationships.ts',
    ],
    ['No certified membership entitlement, renewal, moderation, and churn observation runtime exists.'],
    [
      'Choose and bind one community/membership provider.',
      'Persist entitlement, renewal, cancellation, and moderation receipts.',
      'Validate recurring member outcomes before scaling acquisition.',
    ],
  ),

  pod_personalized_commerce: status(
    'pod_personalized_commerce',
    'live_candidate',
    'PupsonStuff has durable creative, checkout, order, catalog, and Printify fulfillment infrastructure with deliberate dry-run/sample gates.',
    [
      'apps/pupsonstuff/README.md',
      '.github/workflows/pupsonstuff-printify-commissioning.yml',
      'supabase/migrations/20260919135817_pupsonstuff_closeout_core.sql',
    ],
    ['Production fulfillment remains gated by certified catalog variants, credentials, and physical sample acceptance before live mode.'],
    [
      'Complete Printify catalog/variant certification and physical sample matrix.',
      'Run one controlled live order with webhook/reconciliation evidence.',
      'Feed realized margin/refund/customer evidence into Side Hustle outcome learning.',
    ],
  ),

  commerce_affiliate: status(
    'commerce_affiliate',
    'validation_ready',
    'Affiliate monetization is modeled and Growth can generate attributable demand evidence, but merchant-network conversion/payout ingestion is not yet a certified execution layer.',
    [
      'packages/growth-core/src/intelligence/side-hustle-opportunity-factory.ts',
      'packages/opportunity-core/src/domain/side-hustle-experiment-proposal.ts',
      'packages/opportunity-core/src/domain/side-hustle-relationships.ts',
    ],
    ['No canonical affiliate network click/conversion/payout provider is bound.'],
    [
      'Bind one legitimate affiliate network/provider and disclosure policy.',
      'Persist attributable click, conversion, reversal, and payout receipts.',
      'Validate positive contribution after traffic/content production costs.',
    ],
  ),

  dropshipping_product_commerce: status(
    'dropshipping_product_commerce',
    'adapter_ready',
    'The governed Commerce supplier-procurement spine, deterministic routing, preview, approval, execution, and reconciliation exist; live supplier transport is intentionally unbound.',
    [
      'docs/SH_RECON_1_10_DROPSHIPPING_CERTIFICATION_2026-09-21.md',
      '.github/workflows/sh-dropshipping-certification.yml',
      'packages/opportunity-core/src/domain/provider.ts',
    ],
    ['No default live supplier purchasing transport/credentials are certified.'],
    [
      'Select and terms-review one legitimate live supplier provider.',
      'Bind provider prepare/submit/idempotency/tracking implementation.',
      'Run controlled live purchase -> fulfillment -> customer outcome certification.',
    ],
  ),

  drop_servicing: status(
    'drop_servicing',
    'validation_ready',
    'Demand validation and service-provider relationship lanes exist, but third-party service fulfillment, acceptance, and margin reconciliation are not yet implemented as a dedicated runtime.',
    [
      'packages/opportunity-core/src/domain/side-hustle-relationships.ts',
      'packages/opportunity-core/src/domain/side-hustle-experiment-proposal.ts',
    ],
    ['No provider quote/assignment/delivery/acceptance runtime exists for outsourced service fulfillment.'],
    [
      'Build service-provider capability, quote, SLA, and assignment contracts.',
      'Add customer/provider acceptance and dispute/rework receipts.',
      'Prove margin on one paid client job before automating assignment.',
    ],
  ),

  directories_marketplaces: status(
    'directories_marketplaces',
    'validation_ready',
    'The family has discovery, monetization, customer, and partner modeling but no dedicated listing/marketplace transaction runtime.',
    [
      'docs/SH_AWESOME_PASSIVE_INCOME_REFERENCE_AUDIT_2026-09-21.md',
      'packages/opportunity-core/src/domain/side-hustle-relationships.ts',
    ],
    ['Listing lifecycle, moderation, search, billing, and marketplace transaction primitives are not certified.'],
    [
      'Choose the first directory vertical and define listing schema/moderation rules.',
      'Build listing entitlement and paid placement/subscription receipts.',
      'Validate supplier/listing density and buyer demand before marketplace expansion.',
    ],
  ),

  physical_asset_businesses: status(
    'physical_asset_businesses',
    'validation_ready',
    'Asset-booking experiments are defined, but inventory/asset custody, location, maintenance, booking, insurance, and payment operations are not yet a dedicated runtime.',
    [
      'packages/opportunity-core/src/domain/side-hustle-experiment-proposal.ts',
      'docs/SH_BUSINESS_FACTORY_PORTFOLIO_2026-09-22.md',
    ],
    ['No canonical physical-asset inventory/booking/maintenance execution spine is certified.'],
    [
      'Pick one low-capital asset model for the first implementation.',
      'Build asset inventory, availability, booking, custody, and maintenance receipts.',
      'Prove utilization and realized unit economics before acquiring additional assets.',
    ],
  ),

  boring_business_services: status(
    'boring_business_services',
    'validation_ready',
    'The family is represented in discovery, CRM, commercial learning, and validation, but repeatable bookkeeping/spreadsheet/admin service workflows are not yet packaged into certified delivery modules.',
    [
      'docs/SH_BUSINESS_FACTORY_PORTFOLIO_2026-09-22.md',
      'packages/opportunity-core/src/domain/commercial-learning.ts',
    ],
    ['No family-level service templates, QA, delivery acceptance, or client system connectors are certified.'],
    [
      'Choose the first repeatable service (for example spreadsheet cleanup or reporting).',
      'Define inputs, output schema, QA, turnaround, and acceptance receipt.',
      'Run paid deliveries until the workflow earns AI-assisted maturity.',
    ],
  ),

  research_services: status(
    'research_services',
    'execution_spine',
    'Opportunity research and OverageOS provide strong evidence/research primitives that can support paid research, but generalized client delivery and billing remain unbound.',
    [
      'packages/opportunity-core/src/domain/pursuit.ts',
      'docs/SH_BUSINESS_FACTORY_PORTFOLIO_2026-09-22.md',
      'Overageos.pdf.pdf',
    ],
    ['The generic research-service deliverable, citation package, acceptance, and commercial outcome path are not certified.'],
    [
      'Define standardized research brief, provenance, report, and acceptance contracts.',
      'Bind one high-value research vertical to existing evidence collectors.',
      'Complete one paid research engagement and measure hours/profit/rework.',
    ],
  ),

  procurement_subcontracting: status(
    'procurement_subcontracting',
    'execution_spine',
    'SAM/public opportunity discovery, provider research, work-package decomposition, Relationship Core lanes, and prime/subcontractor matching form a substantial operating spine.',
    [
      'docs/architecture/SIDE-HUSTLE-CRM-FOLD-2026-10-01.md',
      '.github/workflows/sam-live-commissioning.yml',
      'packages/opportunity-core/src/domain/sam-provider-broker.ts',
      'packages/opportunity-core/src/domain/subcontract-lifecycle.ts',
    ],
    ['Live public-prime/work-package/provider evidence is still required for real pairing and any bid/contact action remains separately governed.'],
    [
      'Populate verified awarded-prime profiles from live award evidence.',
      'Run automatic prime ↔ subcontractor matching on real work packages.',
      'Take one opportunity through governed outreach/teaming and realized commercial outcome.',
    ],
  ),

  website_revenue_systems: status(
    'website_revenue_systems',
    'validation_ready',
    'Growth owns conversion/discovery intelligence, but a repeatable website build/CRM/conversion deployment service is not yet a certified Builder runtime.',
    [
      'docs/architecture/SOCIAL-PRESENCE-FOLD-2026-09-29.md',
      'docs/SH_BUSINESS_FACTORY_PORTFOLIO_2026-09-22.md',
    ],
    ['No canonical website deployment, CRM integration, analytics baseline, and acceptance package exists for arbitrary clients.'],
    [
      'Define the first website revenue-system template and target stack.',
      'Bind deployment, CRM, analytics, and rollback receipts.',
      'Prove one customer baseline-to-conversion improvement outcome.',
    ],
  ),

  human_premium_services: status(
    'human_premium_services',
    'validation_ready',
    'The Business Factory can identify and validate human-premium offers, but fulfillment is inherently operator-dependent and no reusable service delivery runtime is certified.',
    [
      'docs/SH_BUSINESS_FACTORY_PORTFOLIO_2026-09-22.md',
      'packages/opportunity-core/src/domain/side-hustle-experiment-proposal.ts',
    ],
    ['No selected premium service has a canonical intake, scheduling, delivery, acceptance, and outcome workflow.'],
    [
      'Select the first premium human service worth productizing.',
      'Build intake, scheduling, evidence, deliverable, and acceptance flow.',
      'Use Jhadina for preparation/QA while keeping human delivery explicit.',
    ],
  ),

  trading_investing_intelligence: status(
    'trading_investing_intelligence',
    'capability_only',
    'This family is intentionally a Money intelligence capability rather than a standalone Side Hustle business; it must not acquire separate trading authority through the Business Factory.',
    [
      'packages/money-core/src/index.ts',
      'packages/opportunity-core/src/domain/side-hustle-experiment-proposal.ts',
      'docs/SH_BUSINESS_FACTORY_PORTFOLIO_2026-09-22.md',
    ],
    ['Standalone Side Hustle experiments are intentionally prohibited for this capability family.'],
    [
      'Keep market/trading intelligence inside Money Core and Coffer governance.',
      'Expose evidence-backed intelligence to other ventures only as context.',
      'Do not convert Business Factory classification into execution or money-movement authority.',
    ],
    false,
  ),

  pr_authority: status(
    'pr_authority',
    'execution_spine',
    'Growth/Social presence, durable content, CRM relationship context, and authority-building intelligence provide a useful spine, but media-placement execution is not yet provider-certified.',
    [
      'packages/growth-core/src/intelligence/marketing-presence.ts',
      'docs/architecture/SOCIAL-PRESENCE-FOLD-2026-09-29.md',
      'packages/opportunity-core/src/domain/side-hustle-relationships.ts',
    ],
    ['No certified press/media distribution or placement provider and no family-level client outcome certification.'],
    [
      'Define legitimate PR offer types and evidence standards.',
      'Bind media/contact research and governed outreach without fabricated proof.',
      'Measure placements/citations/qualified traffic separately from customer revenue outcomes.',
    ],
  ),
})

export function getSideHustleProductionStatus(family: SideHustleFamily): SideHustleProductionStatus {
  return SIDE_HUSTLE_PRODUCTION_STATUS[family]
}

export function listSideHustleProductionStatus(): SideHustleProductionStatus[] {
  return SIDE_HUSTLE_DEFINITIONS.map((definition) => SIDE_HUSTLE_PRODUCTION_STATUS[definition.family])
}
