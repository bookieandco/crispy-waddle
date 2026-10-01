import { US_STATE_NAMES, type UsStateOrDcCode } from './public-jurisdiction-catalog.js'

export type PublicComplianceTopic=
  |'contractor_license'
  |'public_works_registration'
  |'prevailing_wage'
  |'apprenticeship'
  |'certified_payroll'
  |'workers_comp'
  |'debarment'
  |'bonding'

export type PublicComplianceSearchResult={
  title:string
  url:string
  snippet?:string
  provider:'web_search'|'exa'
  observedAt:string
}

export type PublicComplianceSourceCandidate={
  id:string
  state:UsStateOrDcCode
  sourceName:string
  sourceUrl:string
  topics:PublicComplianceTopic[]
  governmentDomain:boolean
  stateRelevant:boolean
  officialSourceVerified:boolean
  confidence:number
  evidenceRefs:string[]
  blockers:string[]
}

const topicSignals:Record<PublicComplianceTopic,string[]>={
  contractor_license:['contractor license','licensing board','contractors license'],
  public_works_registration:['public works contractor','contractor registration','public works registration'],
  prevailing_wage:['prevailing wage','wage determination'],
  apprenticeship:['apprenticeship','apprentice requirements'],
  certified_payroll:['certified payroll','payroll reporting'],
  workers_comp:['workers compensation','workers comp'],
  debarment:['debarred','debarment','suspended contractors'],
  bonding:['payment bond','performance bond','bid bond','bonding requirements'],
}

const clean=(value:string)=>value.replace(/\s+/g,' ').trim()

function safeUrl(raw:string):URL|undefined{
  try{
    const u=new URL(raw)
    if(!['http:','https:'].includes(u.protocol))return undefined
    return u
  }catch{return undefined}
}

function governmentDomain(raw:string){
  const u=safeUrl(raw)
  if(!u)return false
  const host=u.hostname.toLowerCase().replace(/\.$/,'')
  return host.endsWith('.gov')||host.endsWith('.gov.us')||host.endsWith('.us')
}

function detectedTopics(text:string):PublicComplianceTopic[]{
  const hay=clean(text).toLowerCase()
  return (Object.entries(topicSignals) as Array<[PublicComplianceTopic,string[]]>)
    .filter(([,signals])=>signals.some(signal=>hay.includes(signal)))
    .map(([topic])=>topic)
}

function stateRelevant(state:UsStateOrDcCode,text:string){
  const hay=clean(text).toLowerCase()
  const stateName=US_STATE_NAMES[state].toLowerCase()
  return hay.includes(stateName)||new RegExp(`\\b${state.toLowerCase()}\\b`).test(hay)
}

export function buildPublicComplianceDiscoveryQueries(state:UsStateOrDcCode):string[]{
  const name=US_STATE_NAMES[state]
  return [
    `${name} contractor license public works contractor registration official`,
    `${name} prevailing wage apprenticeship certified payroll public works official`,
    `${name} workers compensation debarment public works contractor bonding official`,
  ]
}

export function assessPublicComplianceSearchResult(input:{
  state:UsStateOrDcCode
  result:PublicComplianceSearchResult
}):PublicComplianceSourceCandidate{
  const u=safeUrl(input.result.url)
  const text=`${input.result.title} ${input.result.snippet??''} ${u?.pathname??''}`
  const topics=detectedTopics(text)
  const isGov=governmentDomain(input.result.url)
  const isState=stateRelevant(input.state,text)
  const blockers:string[]=[]
  if(!u)blockers.push('Candidate URL is not safe HTTP(S).')
  if(!isGov)blockers.push('Compliance source is not on an official government domain.')
  if(!isState)blockers.push('Search evidence does not clearly match the target state.')
  if(!topics.length)blockers.push('Search evidence does not identify a configured compliance topic.')
  const officialSourceVerified=Boolean(u&&isGov&&isState&&topics.length)
  return {
    id:`compliance-source:${input.state}:${encodeURIComponent(input.result.url).slice(0,180)}`,
    state:input.state,
    sourceName:clean(input.result.title)||u?.hostname||input.result.url,
    sourceUrl:input.result.url,
    topics,
    governmentDomain:isGov,
    stateRelevant:isState,
    officialSourceVerified,
    confidence:officialSourceVerified?0.9:isGov&&topics.length?0.6:0.25,
    evidenceRefs:[`search:${input.result.provider}:${input.result.observedAt}:${input.result.url}`],
    blockers,
  }
}

export function complianceTopicCoverage(candidates:PublicComplianceSourceCandidate[]){
  const verified=candidates.filter(candidate=>candidate.officialSourceVerified)
  const topics=[...new Set(verified.flatMap(candidate=>candidate.topics))]
  return {
    verifiedSourceCount:verified.length,
    coveredTopics:topics.sort(),
    coveragePct:Math.round((topics.length/Object.keys(topicSignals).length)*100),
    packAutoVerificationAuthorized:false as const,
  }
}
