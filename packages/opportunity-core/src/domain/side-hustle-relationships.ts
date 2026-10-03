import type {SideHustleFamily} from './side-hustles.js'

export type SideHustleRelationshipPipelineId=
  |'commercial_prospecting'
  |'customer_lifecycle'
  |'affiliate_vendor'
  |'sam_teaming'
  |'public_buyer'
  |'subcontractor_acquisition'

export type SideHustleRelationshipLaneId=
  |'prospects'
  |'customers'
  |'partners'
  |'vendors'
  |'suppliers'
  |'affiliates'
  |'creators'
  |'sponsors'
  |'buyers'
  |'primes'
  |'subcontractors'
  |'data_providers'

export type SideHustleRelationshipLane={
  id:SideHustleRelationshipLaneId
  label:string
  description:string
  pipelineIds:SideHustleRelationshipPipelineId[]
}

export type SideHustleRelationshipScope={
  family:SideHustleFamily
  label:string
  lanes:SideHustleRelationshipLane[]
  canonicalEntityAuthority:'RELATIONSHIP_CORE'
  opportunityAuthority:'OPPORTUNITY_CORE'
  externalActionAuthorized:false
}

const lane=(
  id:SideHustleRelationshipLaneId,
  label:string,
  description:string,
  pipelineIds:SideHustleRelationshipPipelineId[],
):SideHustleRelationshipLane=>({id,label,description,pipelineIds})

const COMMERCIAL=[
  lane('prospects','Prospects','Companies or people that may buy this hustle offer.',['commercial_prospecting']),
  lane('customers','Customers','Qualified and converted customer relationships for this hustle.',['customer_lifecycle']),
]
const PARTNERS=[
  lane('partners','Partners','Business partners and channel relationships that help this hustle operate or distribute.',['affiliate_vendor']),
  lane('vendors','Vendors','Tools, platforms and service vendors used by this hustle.',['affiliate_vendor']),
]
const COMMERCE=[
  lane('customers','Customers','Buyers and repeat customers for this commerce hustle.',['customer_lifecycle']),
  lane('suppliers','Suppliers','Product, fulfillment and operational suppliers.',['affiliate_vendor']),
  lane('affiliates','Affiliates','Affiliate and referral relationships.',['affiliate_vendor']),
]
const CREATOR=[
  lane('creators','Creators','Creator and talent relationships relevant to this hustle.',['affiliate_vendor']),
  lane('sponsors','Sponsors','Brands and sponsors that may fund or buy placements.',['commercial_prospecting']),
  lane('affiliates','Affiliates','Affiliate and referral relationships.',['affiliate_vendor']),
  lane('customers','Customers','Direct buyers, members or clients.',['customer_lifecycle']),
]
const PROCURE=[
  lane('buyers','Public Buyers','Government/public buyers attached to opportunities.',['public_buyer']),
  lane('primes','Primes','Prime contractors, incumbents and teaming targets.',['sam_teaming']),
  lane('subcontractors','Subcontractors','Providers and subcontractors matched to scopes and primes.',['subcontractor_acquisition']),
  lane('partners','Teaming Partners','Other evidence-backed teaming relationships.',['sam_teaming','subcontractor_acquisition']),
]

const SCOPE_LANES:Record<SideHustleFamily,SideHustleRelationshipLane[]>={
  ai_business_implementation:[...COMMERCIAL,...PARTNERS],
  business_automation:[...COMMERCIAL,...PARTNERS],
  business_systems:[...COMMERCIAL,...PARTNERS],
  lead_generation_growth:[...COMMERCIAL,...PARTNERS],
  ai_discovery_seo:[...COMMERCIAL,...PARTNERS],
  content_social:[...COMMERCIAL,...PARTNERS],
  creative_advertising:[...COMMERCIAL,...PARTNERS],
  media_production:[...COMMERCIAL,...PARTNERS],
  owned_media:[...CREATOR],
  creator_monetization:[...CREATOR],
  digital_products:[...COMMERCE,lane('prospects','Prospects','Potential institutional or business buyers.',['commercial_prospecting'])],
  software_apps:[...COMMERCIAL,...PARTNERS],
  communities:[
    lane('customers','Members / Customers','Prospective and active paying members.',['customer_lifecycle']),
    lane('partners','Community Partners','Partners, moderators, vendors and referral relationships.',['affiliate_vendor']),
    lane('prospects','Prospects','Organizations or people that may buy memberships or group access.',['commercial_prospecting']),
  ],
  pod_personalized_commerce:[...COMMERCE],
  commerce_affiliate:[
    lane('affiliates','Affiliates','Affiliate networks, publishers and referral partners.',['affiliate_vendor']),
    lane('vendors','Merchants / Vendors','Merchants and product partners whose offers are monetized.',['affiliate_vendor']),
    lane('customers','Customers','Owned customer relationships when the hustle sells directly.',['customer_lifecycle']),
  ],
  dropshipping_product_commerce:[...COMMERCE],
  drop_servicing:[...COMMERCIAL,lane('suppliers','Service Providers','Third-party service providers used for fulfillment.',['affiliate_vendor'])],
  directories_marketplaces:[...COMMERCIAL,...PARTNERS,lane('customers','Customers','Paying listers, buyers or marketplace customers.',['customer_lifecycle'])],
  physical_asset_businesses:[...COMMERCIAL,...PARTNERS],
  boring_business_services:[...COMMERCIAL,...PARTNERS],
  research_services:[...COMMERCIAL,...PARTNERS],
  procurement_subcontracting:[...PROCURE],
  website_revenue_systems:[...COMMERCIAL,...PARTNERS],
  human_premium_services:[...COMMERCIAL,...PARTNERS],
  trading_investing_intelligence:[
    lane('data_providers','Data Providers','Market-data, execution, research and infrastructure providers.',['affiliate_vendor']),
    lane('partners','Research Partners','Evidence and intelligence partners; this capability does not authorize trading.',['affiliate_vendor']),
  ],
  pr_authority:[...COMMERCIAL,lane('partners','Media / Distribution Partners','Media, syndication, placement and authority-building partners.',['affiliate_vendor'])],
}

export function getSideHustleRelationshipScope(
  family:SideHustleFamily,
  label?:string,
):SideHustleRelationshipScope{
  return {
    family,
    label:label??family.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
    lanes:SCOPE_LANES[family].map(row=>({...row,pipelineIds:[...row.pipelineIds]})),
    canonicalEntityAuthority:'RELATIONSHIP_CORE',
    opportunityAuthority:'OPPORTUNITY_CORE',
    externalActionAuthorized:false,
  }
}

export function relationshipPipelinesForSideHustle(family:SideHustleFamily):SideHustleRelationshipPipelineId[]{
  return [...new Set(SCOPE_LANES[family].flatMap(row=>row.pipelineIds))]
}

export function laneForPipeline(
  family:SideHustleFamily,
  pipelineId:string,
):SideHustleRelationshipLane|undefined{
  return SCOPE_LANES[family].find(row=>row.pipelineIds.includes(pipelineId as SideHustleRelationshipPipelineId))
}

export function isSideHustleRelationshipPipelineId(value:unknown):value is SideHustleRelationshipPipelineId{
  return typeof value==='string'&&[
    'commercial_prospecting','customer_lifecycle','affiliate_vendor',
    'sam_teaming','public_buyer','subcontractor_acquisition',
  ].includes(value)
}
