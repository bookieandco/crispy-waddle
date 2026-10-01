import type { PublicJurisdictionLevel, PublicSourceAdapterKind, PublicProcurementSourceKind, UsStateOrDcCode } from './public-opportunity-grid.js'

export type PublicSourceDiscoveryProvider='web_search'|'exa'|'manual'
export type PublicSourceCandidateStatus='candidate'|'official_owner_verified'|'official_portal_verified'|'rejected'

export type PublicJurisdictionDescriptor={
  id:string
  level:PublicJurisdictionLevel
  name:string
  state:UsStateOrDcCode
  county?:string
  locality?:string
  officialDomainHints?:string[]
}

export type PublicSourceSearchResult={
  title:string
  url:string
  snippet?:string
  provider:PublicSourceDiscoveryProvider
  observedAt:string
}

export type OfficialLinkEvidence={
  officialPageUrl:string
  linkedUrl:string
  anchorText:string
  evidenceRef:string
}

export type PublicProcurementSourceCandidate={
  id:string
  jurisdictionId:string
  sourceName:string
  sourceUrl:string
  sourceKinds:PublicProcurementSourceKind[]
  adapterKind:PublicSourceAdapterKind
  provider:PublicSourceDiscoveryProvider
  governmentDomain:boolean
  jurisdictionSignals:string[]
  procurementSignals:string[]
  officialLinkEvidence?:OfficialLinkEvidence
  status:PublicSourceCandidateStatus
  confidence:number
  evidenceRefs:string[]
  blockers:string[]
}

const procurementTerms=[
  'procurement','purchasing','bids','bid opportunities','solicitations','rfp','rfq','rfi',
  'vendor portal','contract opportunities','public works','awards','contracts',
] as const

const portalHosts=[
  'opengov.com','planetbids.com','bidnetdirect.com','bonfirehub.com','publicpurchase.com',
  'ionwave.net','demandstar.com','periscopeholdings.com','bidsandtenders.net',
] as const

const uniq=(values:string[])=>[...new Set(values.map(v=>v.trim()).filter(Boolean))]
const clean=(value:string)=>value.replace(/\s+/g,' ').trim()
const tokens=(value:string)=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(x=>x.length>2)

function safeUrl(raw:string):URL|undefined{
  try{
    const url=new URL(raw)
    if(url.protocol!=='https:'&&url.protocol!=='http:')return undefined
    if(['localhost','127.0.0.1','0.0.0.0','::1'].includes(url.hostname.toLowerCase()))return undefined
    return url
  }catch{return undefined}
}

export function isGovernmentProcurementDomain(rawUrl:string):boolean{
  const url=safeUrl(rawUrl)
  if(!url)return false
  const host=url.hostname.toLowerCase().replace(/\.$/,'')
  return host.endsWith('.gov')
}

export function isKnownProcurementPortal(rawUrl:string):boolean{
  const url=safeUrl(rawUrl)
  if(!url)return false
  const host=url.hostname.toLowerCase()
  return portalHosts.some(portal=>host===portal||host.endsWith('.'+portal))
}

export function buildPublicSourceDiscoveryQueries(jurisdiction:PublicJurisdictionDescriptor):string[]{
  const levelLabel:Record<PublicJurisdictionLevel,string>={
    state:'state government',
    county:'county',
    city:'city municipal',
    school_district:'school district',
    special_district:'special district',
    authority:'public authority',
    public_university:'public university',
    public_hospital:'public hospital',
  }
  const place=[jurisdiction.name,jurisdiction.county&&jurisdiction.level!=='county'?jurisdiction.county:undefined,jurisdiction.state].filter(Boolean).join(' ')
  const kind=levelLabel[jurisdiction.level]
  return uniq([
    `${place} ${kind} procurement bids solicitations vendor portal`,
    `${place} ${kind} purchasing RFP RFQ contract opportunities`,
    `${place} ${kind} awards awarded contracts vendor supplier`,
    `${place} ${kind} board agenda capital improvement contracts`,
  ])
}

function jurisdictionEvidence(jurisdiction:PublicJurisdictionDescriptor,text:string):string[]{
  const hay=tokens(text)
  const required=tokens(jurisdiction.name)
  const hits=required.filter(token=>hay.includes(token))
  const signals:string[]=[]
  if(required.length&&hits.length/required.length>=0.5)signals.push('name_match')
  if(hay.includes(jurisdiction.state.toLowerCase()))signals.push('state_match')
  if(jurisdiction.county&&tokens(jurisdiction.county).some(token=>hay.includes(token)))signals.push('county_match')
  return signals
}

function procurementEvidence(text:string):string[]{
  const hay=clean(text).toLowerCase()
  return procurementTerms.filter(term=>hay.includes(term))
}

function inferAdapterKind(url:string,title:string,snippet:string):PublicSourceAdapterKind{
  const parsed=safeUrl(url)
  const path=parsed?.pathname.toLowerCase()??''
  const text=`${title} ${snippet}`.toLowerCase()
  if(/\.pdf(?:$|\?)/.test(path))return 'pdf_index'
  if(/rss|feed/.test(text)||/\.xml(?:$|\?)/.test(path))return 'rss'
  if(/api|json/.test(text))return 'api'
  if(/search|lookup/.test(text)||/search|lookup/.test(path))return 'search_form'
  if(isKnownProcurementPortal(url)||/portal|eprocure|e-procure|vendor/.test(text))return 'portal'
  return 'html'
}

function inferKinds(text:string):PublicProcurementSourceKind[]{
  const hay=text.toLowerCase()
  const kinds:PublicProcurementSourceKind[]=[]
  if(/bid|solicitation|rfp|rfq|rfi|contract opportunit/.test(hay))kinds.push('solicitation')
  if(/award|awarded contract/.test(hay))kinds.push('award')
  if(/capital plan|capital improvement|cip/.test(hay))kinds.push('capital_plan')
  if(/board agenda|meeting agenda/.test(hay))kinds.push('board_agenda')
  if(/budget/.test(hay))kinds.push('budget')
  if(/public works/.test(hay))kinds.push('public_works_project')
  if(/vendor|supplier|registration/.test(hay))kinds.push('vendor_portal')
  if(/cooperative/.test(hay))kinds.push('cooperative_contract')
  return kinds.length?kinds:['solicitation']
}

export function assessPublicSourceSearchResult(input:{
  jurisdiction:PublicJurisdictionDescriptor
  result:PublicSourceSearchResult
  officialLinkEvidence?:OfficialLinkEvidence
}):PublicProcurementSourceCandidate{
  const {jurisdiction,result}=input
  const parsed=safeUrl(result.url)
  const text=`${result.title} ${result.snippet??''} ${parsed?.pathname??''}`
  const jurisdictionSignals=jurisdictionEvidence(jurisdiction,text)
  const procurementSignals=procurementEvidence(text)
  const governmentDomain=isGovernmentProcurementDomain(result.url)
  const portal=isKnownProcurementPortal(result.url)
  const blockers:string[]=[]
  let status:PublicSourceCandidateStatus='candidate'
  let confidence=0.2

  if(!parsed){
    blockers.push('Candidate URL is not a safe HTTP(S) URL.')
    status='rejected'
    confidence=0
  }else if(procurementSignals.length===0){
    blockers.push('Search evidence does not identify a procurement function.')
  }else if(jurisdictionSignals.length===0){
    blockers.push('Search evidence does not match the target jurisdiction.')
  }else if(governmentDomain){
    status='official_owner_verified'
    confidence=0.9
  }else if(input.officialLinkEvidence&&input.officialLinkEvidence.linkedUrl===result.url){
    status='official_portal_verified'
    confidence=0.95
  }else if(portal){
    blockers.push('Known procurement portal is discovery-only until an official jurisdiction page links to it.')
    confidence=0.55
  }else{
    blockers.push('Non-government source requires official backlink corroboration.')
    confidence=0.35
  }

  const evidenceRefs=uniq([
    `search:${result.provider}:${result.observedAt}:${result.url}`,
    input.officialLinkEvidence?.evidenceRef??'',
  ])

  return {
    id:`source-candidate:${jurisdiction.id}:${encodeURIComponent(result.url).slice(0,180)}`,
    jurisdictionId:jurisdiction.id,
    sourceName:clean(result.title)||parsed?.hostname||result.url,
    sourceUrl:result.url,
    sourceKinds:inferKinds(text),
    adapterKind:inferAdapterKind(result.url,result.title,result.snippet??''),
    provider:result.provider,
    governmentDomain,
    jurisdictionSignals,
    procurementSignals,
    officialLinkEvidence:input.officialLinkEvidence,
    status,
    confidence,
    evidenceRefs,
    blockers,
  }
}

export function extractOfficialProcurementLinks(input:{
  officialPageUrl:string
  html:string
  evidenceRef:string
}):OfficialLinkEvidence[]{
  if(!isGovernmentProcurementDomain(input.officialPageUrl))return[]
  const out:OfficialLinkEvidence[]=[]
  for(const match of input.html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    const raw=match[1]??''
    const anchor=clean((match[2]??'').replace(/<[^>]+>/g,' '))
    let linked:string
    try{linked=new URL(raw,input.officialPageUrl).toString()}catch{continue}
    const linkText=`${anchor} ${linked}`
    if(procurementEvidence(linkText).length===0&&!isKnownProcurementPortal(linked))continue
    out.push({officialPageUrl:input.officialPageUrl,linkedUrl:linked,anchorText:anchor,evidenceRef:input.evidenceRef})
  }
  return out
}

export type PublicSourceDiscoveryDecision={
  jurisdictionId:string
  verifiedSources:PublicProcurementSourceCandidate[]
  reviewCandidates:PublicProcurementSourceCandidate[]
  rejectedCandidates:PublicProcurementSourceCandidate[]
  status:'SOURCE_VERIFIED'|'REVIEW_REQUIRED'|'NO_SOURCE_FOUND'
  automaticAdapterActivationAuthorized:false
  externalContactAuthorized:false
}

export function decidePublicSourceDiscovery(
  jurisdictionId:string,
  candidates:PublicProcurementSourceCandidate[],
):PublicSourceDiscoveryDecision{
  const verifiedSources=candidates.filter(c=>c.status==='official_owner_verified'||c.status==='official_portal_verified')
    .sort((a,b)=>b.confidence-a.confidence||a.sourceUrl.localeCompare(b.sourceUrl))
  const reviewCandidates=candidates.filter(c=>c.status==='candidate')
    .sort((a,b)=>b.confidence-a.confidence||a.sourceUrl.localeCompare(b.sourceUrl))
  const rejectedCandidates=candidates.filter(c=>c.status==='rejected')
  const status:PublicSourceDiscoveryDecision['status']=verifiedSources.length?'SOURCE_VERIFIED':reviewCandidates.length?'REVIEW_REQUIRED':'NO_SOURCE_FOUND'
  return {jurisdictionId,verifiedSources,reviewCandidates,rejectedCandidates,status,automaticAdapterActivationAuthorized:false,externalContactAuthorized:false}
}
