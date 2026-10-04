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
    'adapter_ready',
    'Canonical AI-implementation scope, delivery, acceptance, routing, and paid-outcome evidence now run through the shared Side Hustle commercial runtime; customer-specific Builder/Growth execution remains externally governed.',
    [
      'packages/opportunity-core/src/domain/side-hustle-service-template.ts',
      'packages/opportunity-core/src/domain/side-hustle-commercial.ts',
      'apps/jhadina-web/src/lib/opportunities/side-hustle-commercial-runtime.ts',
    ],
    ['A live customer implementation still needs its concrete Builder/Growth executor, access, and realized outcome evidence.'],
    [
      'Bind the first approved implementation scope to its concrete Builder/Growth executor.',
      'Run one customer implementation through delivery, acceptance, and rollback/fallback evidence.',
      'Link realized paid outcome evidence into commercial certification and maturity assessment.',
    ],
  ),

  business_automation: status(
    'business_automation',
    'adapter_ready',
    'A reusable workflow-audit, automation-build, failure/rollback QA, delivery, and customer-acceptance contract now exists on the shared commercial runtime.',
    [
      'packages/opportunity-core/src/domain/side-hustle-service-template.ts',
      'packages/opportunity-core/src/domain/side-hustle-commercial.ts',
      'apps/jhadina-web/src/lib/opportunities/side-hustle-commercial-runtime.ts',
    ],
    ['The first real automation still needs customer-system credentials/connectors and measured before/after operating evidence.'],
    [
      'Bind one customer workflow to the appropriate connector/Builder executor.',
      'Exercise happy path, failure path, rollback, and manual fallback in the real environment.',
      'Certify one paid automation engagement with measured cycle-time/error/ROI evidence.',
    ],
  ),

  business_systems: status(
    'business_systems',
    'adapter_ready',
    'Requirements, installation/integration scope, operator handoff, acceptance, routing, and outcome evidence now have a canonical service template and durable commercial runtime.',
    [
      'packages/opportunity-core/src/domain/side-hustle-service-template.ts',
      'packages/opportunity-core/src/domain/side-hustle-commercial.ts',
      'apps/jhadina-web/src/lib/opportunities/side-hustle-commercial-runtime.ts',
    ],
    ['Customer-specific system connectors, credentials, and one live installation outcome are still required.'],
    [
      'Bind the first systems package to its actual connector/Builder execution plan.',
      'Capture access boundaries, installation receipts, rollback/recovery, and operator handoff.',
      'Prove one paid installation with accepted before/after operating evidence.',
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
    'adapter_ready',
    'Owned Media now has a durable property and production-cycle registry, approval-bound publication observations, analytics/monetization evidence, authenticated API, atomic state transitions, and Postgres persistence.',
    [
      'packages/opportunity-core/src/domain/side-hustle-owned-media.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-operations.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-storefront.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-task-engine.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-business-pipeline.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-business-cycle.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-product-sniper.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-product-sniper-learning.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-product-truth.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-product-binding.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-sku-lifecycle.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-product-publication-lineage.ts',
      'apps/jhadina-web/src/lib/opportunities/search-commerce-product-sniper-auto-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/search-commerce-product-binding-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/search-commerce-sku-lifecycle-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/search-commerce-product-publication-runtime.ts',
      'apps/jhadina-web/src/app/api/internal/opportunities/venture/business-pipeline/route.ts',
      'apps/jhadina-web/src/lib/opportunities/venture-search-commerce-business-cycle.ts',
      'apps/jhadina-web/src/lib/opportunities/search-commerce-product-sniper-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/search-commerce-product-sniper-learning-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/search-commerce-product-truth-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/side-hustle-specialized-runtime.ts',
      'supabase/migrations/20261003150000_side_hustle_specialized_runtime.sql',
      'packages/shotlist-core/src/youtube-channel-intelligence.ts',
    ],
    ['No live first-party channel analytics connector or governed publishing provider is yet certified against this adapter.'],
    [
      'Bind first-party channel analytics and revenue observations to the adapter.',
      'Connect Shotlist -> Director -> approval -> provider publish for one owned channel.',
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
    'adapter_ready',
    'Digital products now have the durable Commerce offer/delivery spine plus a Digital Product Studio foundation and immutable owner-scoped registry for opportunity scores, Industry Product Matrix cells, B2B ROI assessments, product definitions, freshness-bound marketplace policies/eligibility, and rights/provenance evidence.',
    [
      'packages/opportunity-core/src/domain/side-hustle-commerce.ts',
      'packages/opportunity-core/src/domain/side-hustle-digital-product-studio.ts',
      'packages/opportunity-core/src/domain/side-hustle-digital-product-registry.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-operations.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-storefront.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-task-engine.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-business-pipeline.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-business-cycle.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-product-sniper.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-product-sniper-learning.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-product-truth.ts',
      'apps/jhadina-web/src/lib/opportunities/venture-search-commerce-business-cycle.ts',
      'apps/jhadina-web/src/lib/opportunities/search-commerce-product-sniper-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/search-commerce-product-sniper-learning-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/search-commerce-product-truth-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/side-hustle-commerce-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/digital-product-studio-runtime.ts',
      'supabase/migrations/20261003143000_side_hustle_commerce_runtime.sql',
      'supabase/migrations/20261003221000_side_hustle_digital_product_studio_registry.sql',
    ],
    [
      'Creative production/listing factories and marketplace publisher adapters are not yet bound.',
      'No live checkout/payment provider and customer-facing digital delivery provider are certified yet.',
    ],
    [
      'Build the deck/form/workbook/brand/social factories on the shared Creative Engine.',
      'Bind product QA plus listing mockup/video and conversion-copy generation.',
      'Bind marketplace adapters, checkout truth, delivery, and realized product P&L.',
    ],
  ),

  software_apps: status(
    'software_apps',
    'adapter_ready',
    'Software offers now have durable catalog, access entitlement, recurring subscription observation, delivery, refund/reversal, API, and Postgres state; deployment remains owned by Builder/hosting providers.',
    [
      'packages/opportunity-core/src/domain/side-hustle-commerce.ts',
      'apps/jhadina-web/src/lib/opportunities/side-hustle-commerce-runtime.ts',
      'docs/VENTURE_FACTORY_2026-10-01.md',
    ],
    ['Builder prototype/deploy/rollback and live hosting/subscription provider execution are not yet certified end to end.'],
    [
      'Bind Builder deployment/rollback receipts to software-access delivery.',
      'Bind live billing-provider subscription observations to canonical transaction truth.',
      'Run one paid software commitment through deployment, entitlement, renewal, and outcome learning.',
    ],
  ),

  communities: status(
    'communities',
    'adapter_ready',
    'Community offers now have durable recurring offers, access entitlements, subscription/renewal/cancellation observations, refund/reversal evidence, API, and Postgres persistence.',
    [
      'packages/opportunity-core/src/domain/side-hustle-commerce.ts',
      'apps/jhadina-web/src/lib/opportunities/side-hustle-commerce-runtime.ts',
      'packages/opportunity-core/src/domain/side-hustle-relationships.ts',
    ],
    ['A live membership/community provider and moderation/churn connector are not yet certified.'],
    [
      'Bind one community provider to entitlement provisioning and moderation observations.',
      'Reconcile billing renewal/cancellation truth without duplicating the payment ledger.',
      'Validate recurring member value and churn before scaling acquisition.',
    ],
  ),

  pod_personalized_commerce: status(
    'pod_personalized_commerce',
    'live_candidate',
    'PupsonStuff has durable creative, checkout, order, catalog, and Printify fulfillment infrastructure; Search Commerce now adds scheduled Etsy attention intake, Product Sniper ranking/evidence-gap work, source-owned Product Truth, candidate-to-SKU binding, governed publication observations, seller settlement truth, trusted Commerce outcomes, and bounded realized learning while keeping live fulfillment behind dry-run/sample gates.',
    [
      'apps/pupsonstuff/README.md',
      '.github/workflows/pupsonstuff-printify-commissioning.yml',
      'supabase/migrations/20260919135817_pupsonstuff_closeout_core.sql',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-operations.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-storefront.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-task-engine.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-business-pipeline.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-business-cycle.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-product-sniper.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-product-sniper-learning.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-product-truth.ts',
      'apps/jhadina-web/src/lib/opportunities/venture-search-commerce-business-cycle.ts',
      'apps/jhadina-web/src/lib/opportunities/search-commerce-product-sniper-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/search-commerce-product-sniper-learning-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/search-commerce-product-truth-runtime.ts',
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
    'live_candidate',
    'Affiliate discovery, Partnerize/CJ network ingestion, commission-state reduction, Partnerize account and program-level payout truth, live commissioning, bounded contribution proof, and evidence-backed compliance certification are implemented. Software is ready to collect real commissioning evidence; family certification still depends on actual live provider, conversion, payout, contribution, and current compliance observations.',
    [
      'packages/commerce-adapters/src/affiliate.ts',
      'packages/commerce-adapters/src/affiliate-openaffiliate.ts',
      'packages/commerce-adapters/src/affiliate-network.ts',
      'packages/commerce-adapters/src/affiliate-partnerize.ts',
      'packages/commerce-adapters/src/affiliate-cj.ts',
      'packages/commerce-adapters/src/affiliate-payout.ts',
      'packages/commerce-adapters/src/affiliate-partnerize-payout.ts',
      'packages/commerce-adapters/src/affiliate-partnerize-program-payout.ts',
      'packages/opportunity-core/src/domain/side-hustle-commerce.ts',
      'packages/opportunity-core/src/domain/side-hustle-affiliate-portfolio.ts',
      'packages/opportunity-core/src/domain/side-hustle-affiliate-contribution.ts',
      'packages/opportunity-core/src/domain/side-hustle-affiliate-compliance.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-operations.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-storefront.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-task-engine.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-business-pipeline.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-business-cycle.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-product-sniper.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-product-sniper-learning.ts',
      'packages/opportunity-core/src/domain/side-hustle-search-commerce-product-truth.ts',
      'apps/jhadina-web/src/lib/opportunities/venture-search-commerce-business-cycle.ts',
      'apps/jhadina-web/src/lib/opportunities/search-commerce-product-sniper-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/search-commerce-product-sniper-learning-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/search-commerce-product-truth-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/affiliate-network-sync.ts',
      'apps/jhadina-web/src/lib/opportunities/affiliate-payout-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/affiliate-live-commissioning-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/affiliate-contribution-runtime.ts',
      'apps/jhadina-web/src/lib/opportunities/affiliate-compliance-runtime.ts',
      'supabase/migrations/20261003203000_side_hustle_affiliate_payout_snapshots.sql',
      'supabase/migrations/20261003214500_side_hustle_affiliate_compliance_snapshots.sql',
    ],
    [
      'A legitimate live Partnerize or CJ account still must supply fresh provider/credential evidence.',
      'Family certification requires real approved/paid conversion evidence plus payout-grounded payment evidence.',
      'A completed bounded experiment must prove positive contribution, and current network/program terms plus disclosure/content review evidence must remain fresh.',
    ],
    [
      'Run the controlled read-only affiliate commissioning endpoint against a legitimate provider account.',
      'Complete the bounded affiliate experiment and record positive paid-item contribution evidence.',
      'Record fresh network/program terms, disclosure observations, and content compliance reviews; then re-evaluate all commissioning gates.',
    ],
  ),

  dropshipping_product_commerce: status(
    'dropshipping_product_commerce',
    'adapter_ready',
    'The governed Commerce supplier-procurement spine now includes a concrete Supliful-through-Shopify Admin transport with owner-scoped paid-order PII resolution, verified Supliful product bindings, sourceIdentifier idempotency recovery, and tracking reconciliation.',
    [
      'docs/SH_RECON_1_10_DROPSHIPPING_CERTIFICATION_2026-09-21.md',
      '.github/workflows/sh-dropshipping-certification.yml',
      'packages/commerce-adapters/src/supliful-shopify.ts',
      'apps/jhadina-web/src/lib/commerce/supliful-shopify-runtime.ts',
      'supabase/migrations/20261003234500_supplier_paid_order_vault.sql',
      'supabase/migrations/20261003235000_supliful_shopify_product_bindings.sql',
    ],
    ['A Shopify Admin credential gate, verified live Supliful product bindings, provider terms-review/compliance evidence, and a controlled real order/fulfillment receipt are still required before live certification.'],
    [
      'Commission the credential gate: SHOPIFY_SHOP_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN in the server-only runtime.',
      'Record real Supliful Fulfillment product/variant bindings plus provider terms-review/compliance evidence.',
      'Run one controlled paid order through Shopify -> Supliful -> tracking -> customer outcome and record commissioning evidence.',
    ],
  ),

  drop_servicing: status(
    'drop_servicing',
    'adapter_ready',
    'Drop Servicing now has canonical client scope, provider quote/SLA evidence, provider assignment plans, delivery/customer acceptance, dispute/rework evidence, durable persistence, and provider-cost margin reconciliation.',
    [
      'packages/opportunity-core/src/domain/side-hustle-service-template.ts',
      'packages/opportunity-core/src/domain/side-hustle-drop-servicing.ts',
      'apps/jhadina-web/src/lib/opportunities/side-hustle-drop-servicing-runtime.ts',
      'supabase/migrations/20261003173000_side_hustle_drop_servicing_runtime.sql',
    ],
    ['A live fulfillment provider still needs authorized contact/assignment execution and one real margin-positive customer job.'],
    [
      'Bind the first approved service provider to the governed outreach/assignment authority.',
      'Run provider delivery, any rework, customer acceptance, and payment/outcome observation end to end.',
      'Prove positive realized margin before allowing repeat automated provider selection.',
    ],
  ),

  directories_marketplaces: status(
    'directories_marketplaces',
    'adapter_ready',
    'Directories now have durable paid offers, entitlements, listing lifecycle/moderation state, subscription observations, refund/reversal evidence, API, and Postgres persistence.',
    [
      'packages/opportunity-core/src/domain/side-hustle-commerce.ts',
      'apps/jhadina-web/src/lib/opportunities/side-hustle-commerce-runtime.ts',
      'packages/opportunity-core/src/domain/side-hustle-relationships.ts',
    ],
    ['Search/ranking, live billing, and a customer-facing directory surface are not yet certified as one production vertical.'],
    [
      'Choose the first directory vertical and bind its search/ranking surface.',
      'Connect paid placement/subscription transaction truth to listing entitlement.',
      'Validate listing density, buyer demand, moderation load, and recurring economics.',
    ],
  ),

  physical_asset_businesses: status(
    'physical_asset_businesses',
    'adapter_ready',
    'Physical assets now have durable inventory, availability, reservation, booking, atomic checkout/return custody, maintenance, location, transaction-reference evidence, authenticated API, and Postgres persistence.',
    [
      'packages/opportunity-core/src/domain/side-hustle-physical-assets.ts',
      'apps/jhadina-web/src/lib/opportunities/side-hustle-specialized-runtime.ts',
      'supabase/migrations/20261003150000_side_hustle_specialized_runtime.sql',
    ],
    ['A selected live asset vertical still needs insurance/compliance rules, booking/payment provider binding, and real utilization evidence.'],
    [
      'Pick one low-capital asset model and bind its insurance/compliance requirements.',
      'Connect booking/payment transaction truth without granting payment authority to the inventory runtime.',
      'Prove utilization and realized unit economics before acquiring additional assets.',
    ],
  ),

  boring_business_services: status(
    'boring_business_services',
    'adapter_ready',
    'A standardized intake, processing, QA, delivery, acceptance, routing, and commercial-outcome template now exists for repeatable back-office and administrative services.',
    [
      'packages/opportunity-core/src/domain/side-hustle-service-template.ts',
      'packages/opportunity-core/src/domain/side-hustle-commercial.ts',
      'apps/jhadina-web/src/lib/opportunities/side-hustle-commercial-runtime.ts',
    ],
    ['The first chosen service still needs its concrete input/output connector and paid delivery evidence.'],
    [
      'Choose the first repeatable service and bind its real source/output systems.',
      'Run the documented QA and delivery acceptance loop on live customer work.',
      'Accumulate paid outcome, rework, turnaround, and margin evidence before scaling.',
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
    'adapter_ready',
    'Website revenue work now has a canonical baseline, deployment, rollback, measurement, delivery, and acceptance contract on the shared commercial runtime.',
    [
      'packages/opportunity-core/src/domain/side-hustle-service-template.ts',
      'packages/opportunity-core/src/domain/side-hustle-commercial.ts',
      'packages/growth-core/src/intelligence/marketing-presence.ts',
    ],
    ['A concrete customer hosting/deployment stack plus CRM/analytics provider binding and one measured conversion outcome remain unverified.'],
    [
      'Bind the first target stack to Builder/Vercel plus CRM and analytics providers.',
      'Capture deployment and rollback evidence alongside the pre-change baseline.',
      'Prove one paid baseline-to-conversion improvement outcome.',
    ],
  ),

  human_premium_services: status(
    'human_premium_services',
    'adapter_ready',
    'Human-premium work now has reusable client intake, Jhadina-assisted preparation, explicitly human delivery, acceptance, routing, and outcome evidence contracts.',
    [
      'packages/opportunity-core/src/domain/side-hustle-service-template.ts',
      'packages/opportunity-core/src/domain/side-hustle-commercial.ts',
      'apps/jhadina-web/src/lib/opportunities/side-hustle-commercial-runtime.ts',
    ],
    ['The first premium service still needs a selected human operator, scheduling/booking path, and paid customer evidence.'],
    [
      'Select the first premium human service and bind its operator/scheduling path.',
      'Use Jhadina for preparation, evidence, QA, and follow-up while preserving explicit human delivery.',
      'Run one paid engagement through customer acceptance and realized outcome learning.',
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
