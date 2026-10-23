/**
 * National procurement catalog gaps not represented by the 50 states + DC
 * Census Gazetteer-based inventory. Catalog *source* is NOT a live bid feed.
 */
export type ExpansionFamily='territorial_government'|'tribal_government'|'township_or_dependent_government'|'federal_agency'
export type ExpansionCatalogSource={
 id:string;family:ExpansionFamily;officialAuthority:string;officialCatalogUrl:string;
 baselineReferenceDate:string;expectedEntities:number|null
 status:'catalog_source_identified_not_imported'
 authority:'official_catalog_reference'
 identityVerificationRequired:true
 bidFeedVerified:false;externalContactAuthorized:false
}
export const US_TERRITORY_CODES=['PR','GU','VI','AS','MP'] as const
export const NATIONAL_PROCUREMENT_GAP_SOURCES:readonly ExpansionCatalogSource[]=[
 {id:'us-territory-coverage',family:'territorial_government',officialAuthority:'U.S. territorial public purchasing authorities (separately governed)',
  officialCatalogUrl:'https://www.usa.gov/state-governments',baselineReferenceDate:'2026-10-22',expectedEntities:5,
  status:'catalog_source_identified_not_imported',authority:'official_catalog_reference',
  identityVerificationRequired:true,bidFeedVerified:false,externalContactAuthorized:false},
 {id:'bia-recognized-tribal-entities-2026',family:'tribal_government',officialAuthority:'U.S. Department of the Interior / Bureau of Indian Affairs',
  officialCatalogUrl:'https://www.bia.gov/service/tribal-leaders-directory',baselineReferenceDate:'2026-01-30',
  expectedEntities:575,status:'catalog_source_identified_not_imported',authority:'official_catalog_reference',
  identityVerificationRequired:true,bidFeedVerified:false,externalContactAuthorized:false},
 {id:'us-census-2025-independent-local-governments',family:'township_or_dependent_government',
  officialAuthority:'U.S. Census Bureau Government Units Survey',
  officialCatalogUrl:'https://www.census.gov/data/datasets/2025/econ/gus/public-use-files.html',
  baselineReferenceDate:'2025-09-24',expectedEntities:null,
  status:'catalog_source_identified_not_imported',authority:'official_catalog_reference',
  identityVerificationRequired:true,bidFeedVerified:false,externalContactAuthorized:false},
 {id:'us-federal-sam-agency-catalog',family:'federal_agency',
  officialAuthority:'U.S. General Services Administration / SAM.gov',
  officialCatalogUrl:'https://sam.gov/opportunities',
  baselineReferenceDate:'2026-10-22',expectedEntities:null,
  status:'catalog_source_identified_not_imported',authority:'official_catalog_reference',
  identityVerificationRequired:true,bidFeedVerified:false,externalContactAuthorized:false},
] as const
export type PendingJurisdictionIdentity={
 canonicalId:string;family:ExpansionFamily;name:string;
 officialRecordId:string;officialCatalogUrl:string
 territoryCode?:typeof US_TERRITORY_CODES[number]
 authorityConfirmed:boolean;bidPortalUrl?:string;bidPortalOfficiallyLinked:boolean
}
export function assessExpansionIdentity(row:PendingJurisdictionIdentity){
 const identityBlockers:string[]=[]
 if(!row.canonicalId.trim()||!row.name.trim()||!row.officialRecordId.trim())
  identityBlockers.push('Canonical identity and source government-unit ID required.')
 const catalog=NATIONAL_PROCUREMENT_GAP_SOURCES.find(c=>c.family===row.family)
 if(!catalog||catalog.officialCatalogUrl!==row.officialCatalogUrl)
  identityBlockers.push('Official government-unit catalog provenance not matched.')
 if(row.family==='territorial_government'&&(!row.territoryCode||
   !US_TERRITORY_CODES.some(code=>code===row.territoryCode)))
  identityBlockers.push('Territory must have its own supported official code.')
 if(!row.authorityConfirmed)identityBlockers.push('Legal government or procurement authority unverified.')
 const procurementBlockers=(!row.bidPortalUrl||!row.bidPortalOfficiallyLinked)
  ?['No buyer-authorized solicitation source or portal evidence.']:[]
 return {canonicalId:row.canonicalId,governmentIdentityVerified:identityBlockers.length===0,
  officialBuyerPortalObserved:procurementBlockers.length===0,
  bidFeedCertified:false,blockers:[...identityBlockers,...procurementBlockers],
  externalContactAuthorized:false,bidSubmissionAuthorized:false}
}

export type ProcurementPortalFamily='opengov'|'planetbids'|'ionwave'|'bonfire'|'bidnet'|'publicpurchase'|'demandstar'|'bidsandtenders'|'official_owned'|'unknown'
const vendorDomains:readonly [ProcurementPortalFamily,string][]=[
 ['opengov','opengov.com'],['planetbids','planetbids.com'],['ionwave','ionwave.net'],
 ['bonfire','bonfirehub.com'],['bidnet','bidnetdirect.com'],
 ['publicpurchase','publicpurchase.com'],['demandstar','demandstar.com'],
 ['bidsandtenders','bidsandtenders.net'],
]
export function classifyProcurementPortal(input:{
 sourceUrl:string
 officialBuyerLink:string|null
 officialBuyerVerified:boolean
 loginRequired:boolean
 robotsAccessApproved:boolean
 reliableBidIds:boolean
 closedBidDetection:boolean
}){
 const blockers:string[]=[]
 let family:ProcurementPortalFamily='unknown'
 let hostname=''
 try{
  const u=new URL(input.sourceUrl)
  if(u.protocol!=='https:'||u.username||u.password||u.port||
   !u.hostname||['localhost','127.0.0.1','0.0.0.0'].includes(u.hostname)){
   blockers.push('Secure public HTTPS portal URL required.')
  }else{
   hostname=u.hostname.toLowerCase()
   family=vendorDomains.find(([,d])=>hostname===d||hostname.endsWith('.'+d))?.[0]??
    (hostname.endsWith('.gov')?'official_owned':'unknown')
  }
 }catch{blockers.push('Invalid portal URL.')}
 if(!input.officialBuyerVerified||!input.officialBuyerLink)
  blockers.push('Buyer-to-portal official website link must be corroborated.')
 if(!input.robotsAccessApproved)blockers.push('Robots and access terms not reviewed.')
 if(input.loginRequired)blockers.push('Buyer portal requires legitimate human account; do not automate login.')
 if(!input.reliableBidIds)blockers.push('Stable official external bid IDs unverified.')
 if(!input.closedBidDetection)blockers.push('Closed, canceled, expired and addendum statuses not parsed.')
 return {family,hostname,status:blockers.length?'review_required':'parser_pilot_candidate',
  certification:'not_certified',blockers,buyerContactAuthorized:false,automatedLoginAuthorized:false,
  externalFetchAuthorized:false,bidSubmissionAuthorized:false}
}
