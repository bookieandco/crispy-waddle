import {
  SIDE_HUSTLE_DEFINITIONS,
  type SideHustleFamily,
} from './side-hustles.js'

export type SideHustlePrimaryRuntime =
  | 'commercial_service'
  | 'revenue_product'
  | 'owned_media'
  | 'physical_asset'
  | 'drop_servicing'
  | 'pupsonstuff'
  | 'dropshipping'
  | 'money_capability'

export type SideHustleNativeSystem =
  | 'opportunity'
  | 'growth'
  | 'builder'
  | 'media'
  | 'commerce'
  | 'pupsonstuff'
  | 'overage'
  | 'sam'
  | 'money'

export type SideHustleExecutorRegistration = {
  family: SideHustleFamily
  primaryRuntime: SideHustlePrimaryRuntime
  executionOwners: SideHustleNativeSystem[]
  apiRef?: string
  runtimeRef: string
  supportingRefs: readonly string[]
  capabilityOnly: boolean
  requiresCommissioning: boolean
  authority: 'EXECUTOR_ROUTING_ONLY'
  externalActionAuthorized: false
  moneyMovementAuthorized: false
}

const COMMERCIAL_API='/api/opportunities/:id/commercial/work-orders/template'
const COMMERCE_API='/api/opportunities/:id/commerce'
const SPECIALIZED_API='/api/opportunities/:id/specialized'
const DROP_SERVICING_API='/api/opportunities/:id/drop-servicing'

const commercial = (
  family: SideHustleFamily,
  supportingRefs: string[] = [],
): SideHustleExecutorRegistration => registration({
  family,
  primaryRuntime:'commercial_service',
  apiRef:COMMERCIAL_API,
  runtimeRef:'apps/jhadina-web/src/lib/opportunities/side-hustle-commercial-runtime.ts',
  supportingRefs:[
    'packages/opportunity-core/src/domain/side-hustle-service-template.ts',
    ...supportingRefs,
  ],
})

const revenueProduct = (
  family: SideHustleFamily,
  supportingRefs: string[] = [],
): SideHustleExecutorRegistration => registration({
  family,
  primaryRuntime:'revenue_product',
  apiRef:COMMERCE_API,
  runtimeRef:'apps/jhadina-web/src/lib/opportunities/side-hustle-commerce-runtime.ts',
  supportingRefs:[
    'packages/opportunity-core/src/domain/side-hustle-commerce.ts',
    ...supportingRefs,
  ],
})

export const SIDE_HUSTLE_EXECUTOR_REGISTRY: Readonly<Record<
  SideHustleFamily,
  SideHustleExecutorRegistration
>> = Object.freeze({
  ai_business_implementation: commercial('ai_business_implementation',[
    'packages/opportunity-core/src/domain/commercial-learning.ts',
  ]),
  business_automation: commercial('business_automation'),
  business_systems: commercial('business_systems'),
  lead_generation_growth: commercial('lead_generation_growth',[
    'packages/opportunity-core/src/domain/prospect-intelligence.ts',
    'packages/opportunity-core/src/domain/side-hustle-relationships.ts',
  ]),
  ai_discovery_seo: commercial('ai_discovery_seo',[
    'packages/growth-core/src/intelligence/marketing-presence.ts',
  ]),
  content_social: commercial('content_social',[
    'apps/jhadina-web/src/lib/social/growth-content-bridge.ts',
    'packages/social-core/src/automation.ts',
  ]),
  creative_advertising: commercial('creative_advertising',[
    'packages/director-core/src/creative-factory-routing.ts',
    'apps/jhadina-web/src/lib/director-video-job-service.ts',
    'apps/jhadina-web/src/app/api/director/commercial/creative/route.ts',
    'apps/jhadina-web/src/app/api/growth/ads/campaigns/route.ts',
    '.github/workflows/director-creative-factory-once.yml',
  ]),
  media_production: commercial('media_production',[
    'packages/director-core/src/creative-factory-routing.ts',
    'apps/jhadina-web/src/lib/director-video-job-service.ts',
    'apps/jhadina-web/src/app/api/director/production-final/route.ts',
    'services/director-hunyuan/worker.py',
    '.github/workflows/director-creative-factory-once.yml',
  ]),
  owned_media: registration({
    family:'owned_media',
    primaryRuntime:'owned_media',
    apiRef:SPECIALIZED_API,
    runtimeRef:'apps/jhadina-web/src/lib/opportunities/side-hustle-specialized-runtime.ts',
    supportingRefs:[
      'packages/opportunity-core/src/domain/side-hustle-owned-media.ts',
      'packages/shotlist-core/src/youtube-channel-intelligence.ts',
      'packages/director-core/src/creative-factory-routing.ts',
      'apps/jhadina-web/src/lib/director-video-job-service.ts',
      'apps/jhadina-web/src/lib/social/growth-content-bridge.ts',
      '.github/workflows/director-creative-factory-once.yml',
    ],
  }),
  creator_monetization: commercial('creator_monetization',[
    'packages/growth-core/src/intelligence/side-hustle-opportunity-factory.ts',
    'apps/jhadina-web/src/lib/opportunities/side-hustle-commerce-runtime.ts',
  ]),
  digital_products: revenueProduct('digital_products'),
  software_apps: revenueProduct('software_apps',[
    'docs/VENTURE_FACTORY_2026-10-01.md',
  ]),
  communities: revenueProduct('communities',[
    'packages/opportunity-core/src/domain/side-hustle-relationships.ts',
  ]),
  pod_personalized_commerce: registration({
    family:'pod_personalized_commerce',
    primaryRuntime:'pupsonstuff',
    runtimeRef:'apps/pupsonstuff/README.md',
    supportingRefs:[
      'apps/pupsonstuff/lib/fulfillment.ts',
      'apps/pupsonstuff/lib/printify.ts',
      'apps/pupsonstuff/scripts/printify-catalog-sync.ts',
      '.github/workflows/pupsonstuff-launch-convergence.yml',
    ],
  }),
  commerce_affiliate: revenueProduct('commerce_affiliate',[
    'packages/growth-core/src/intelligence/side-hustle-opportunity-factory.ts',
  ]),
  dropshipping_product_commerce: registration({
    family:'dropshipping_product_commerce',
    primaryRuntime:'dropshipping',
    runtimeRef:'apps/jhadina-web/src/lib/commerce/governed-supplier-procurement.ts',
    supportingRefs:[
      'packages/opportunity-core/src/domain/provider.ts',
      '.github/workflows/sh-dropshipping-certification.yml',
    ],
  }),
  drop_servicing: registration({
    family:'drop_servicing',
    primaryRuntime:'drop_servicing',
    apiRef:DROP_SERVICING_API,
    runtimeRef:'apps/jhadina-web/src/lib/opportunities/side-hustle-drop-servicing-runtime.ts',
    supportingRefs:[
      'packages/opportunity-core/src/domain/side-hustle-commercial.ts',
      'packages/opportunity-core/src/domain/side-hustle-drop-servicing.ts',
    ],
  }),
  directories_marketplaces: revenueProduct('directories_marketplaces'),
  physical_asset_businesses: registration({
    family:'physical_asset_businesses',
    primaryRuntime:'physical_asset',
    apiRef:SPECIALIZED_API,
    runtimeRef:'apps/jhadina-web/src/lib/opportunities/side-hustle-specialized-runtime.ts',
    supportingRefs:[
      'packages/opportunity-core/src/domain/side-hustle-physical-assets.ts',
    ],
  }),
  boring_business_services: commercial('boring_business_services'),
  research_services: commercial('research_services',[
    'packages/opportunity-core/src/domain/pursuit.ts',
  ]),
  procurement_subcontracting: commercial('procurement_subcontracting',[
    'packages/opportunity-core/src/domain/sam-operating-system.ts',
    'packages/opportunity-core/src/domain/prime-subcontractor-matching.ts',
    'packages/opportunity-core/src/domain/subcontract-lifecycle.ts',
  ]),
  website_revenue_systems: commercial('website_revenue_systems',[
    'packages/growth-core/src/intelligence/marketing-presence.ts',
  ]),
  human_premium_services: commercial('human_premium_services'),
  trading_investing_intelligence: registration({
    family:'trading_investing_intelligence',
    primaryRuntime:'money_capability',
    runtimeRef:'packages/money-core/src/index.ts',
    supportingRefs:[],
    capabilityOnly:true,
    requiresCommissioning:false,
  }),
  pr_authority: commercial('pr_authority',[
    'packages/growth-core/src/intelligence/marketing-presence.ts',
    'packages/opportunity-core/src/domain/side-hustle-relationships.ts',
  ]),
})

export function getSideHustleExecutorRegistration(
  family:SideHustleFamily,
):SideHustleExecutorRegistration{
  return SIDE_HUSTLE_EXECUTOR_REGISTRY[family]
}

export function listSideHustleExecutorRegistrations():SideHustleExecutorRegistration[]{
  return SIDE_HUSTLE_DEFINITIONS.map(definition=>SIDE_HUSTLE_EXECUTOR_REGISTRY[definition.family])
}

function registration(input:{
  family:SideHustleFamily
  primaryRuntime:SideHustlePrimaryRuntime
  apiRef?:string
  runtimeRef:string
  supportingRefs:string[]
  capabilityOnly?:boolean
  requiresCommissioning?:boolean
}):SideHustleExecutorRegistration{
  const definition=SIDE_HUSTLE_DEFINITIONS.find(row=>row.family===input.family)
  if(!definition)throw new Error(`Unknown Side Hustle executor family: ${input.family}`)
  return Object.freeze({
    family:input.family,
    primaryRuntime:input.primaryRuntime,
    executionOwners:[...definition.executionOwners] as SideHustleNativeSystem[],
    apiRef:input.apiRef,
    runtimeRef:input.runtimeRef,
    supportingRefs:Object.freeze([...new Set(input.supportingRefs)]),
    capabilityOnly:input.capabilityOnly??false,
    requiresCommissioning:input.requiresCommissioning??true,
    authority:'EXECUTOR_ROUTING_ONLY',
    externalActionAuthorized:false,
    moneyMovementAuthorized:false,
  })
}
