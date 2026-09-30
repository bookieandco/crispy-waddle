import type { BrokerProviderCandidate } from './sam-provider-broker.js'

export type AwardNeighborProfile = {
  seedProviderIds: string[]
  seedProviderNames: string[]
  naicsCodes: string[]
  pscCodes: string[]
  keywords: string[]
  evidenceRefs: string[]
}

export type AwardNeighborSearch = {
  naicsCodes: string[]
  pscCodes: string[]
  keywords: string[]
  seedProviderIds: string[]
  reason: string
}

const STOP_WORDS = new Set([
  'about','after','again','against','award','awarded','awarding','based','between','contract','contractor',
  'delivery','department','federal','government','including','other','provide','providing','purchase','services',
  'service','support','system','systems','through','under','using','with','work',
])

const uniq = (values:string[]) => [...new Set(values.map(value=>value.trim()).filter(Boolean))]

function awardBacked(provider:BrokerProviderCandidate){
  return (provider.awardCount??0)>0 || provider.evidence.some(evidence =>
    ['usaspending','sam_award','fpds'].includes(evidence.source),
  )
}

function pscCodes(provider:BrokerProviderCandidate){
  const fromKeywords = provider.keywords.flatMap(value => {
    const match = /^PSC\s+([A-Z0-9]{4,})$/i.exec(value.trim())
    return match ? [match[1]!.toUpperCase()] : []
  })
  const fromEvidence = provider.evidence.flatMap(evidence => {
    const value = evidence.details?.pscCode
    return typeof value === 'string' && value.trim() ? [value.trim().toUpperCase()] : []
  })
  return uniq([...fromKeywords,...fromEvidence])
}

function capabilityTokens(provider:BrokerProviderCandidate){
  const raw = provider.keywords
    .filter(value=>!/^PSC\s+/i.test(value.trim()))
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g,' ')
    .split(/\s+/)
    .map(value=>value.replace(/^-+|-+$/g,''))
    .filter(value=>value.length>=4 && !STOP_WORDS.has(value) && !/^\d+$/.test(value))
  return uniq(raw)
}

function frequency(values:string[]){
  const counts=new Map<string,number>()
  for(const value of values)counts.set(value,(counts.get(value)??0)+1)
  return [...counts.entries()]
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
    .map(([value])=>value)
}

export function buildAwardNeighborProfile(
  providers:BrokerProviderCandidate[],
  maxSeeds=8,
):AwardNeighborProfile{
  const seeds=providers
    .filter(awardBacked)
    .sort((a,b)=>(b.awardCount??0)-(a.awardCount??0)||a.legalName.localeCompare(b.legalName))
    .slice(0,Math.max(1,Math.min(Math.floor(maxSeeds),25)))

  return {
    seedProviderIds:seeds.map(seed=>seed.id),
    seedProviderNames:seeds.map(seed=>seed.legalName),
    naicsCodes:frequency(seeds.flatMap(seed=>seed.naicsCodes)).slice(0,6),
    pscCodes:frequency(seeds.flatMap(pscCodes)).slice(0,6),
    keywords:frequency(seeds.flatMap(capabilityTokens)).slice(0,12),
    evidenceRefs:uniq(seeds.flatMap(seed=>seed.evidence.map(evidence=>evidence.id))),
  }
}

export function buildAwardNeighborSearches(
  profile:AwardNeighborProfile,
  maxQueries=3,
):AwardNeighborSearch[]{
  if(!profile.seedProviderIds.length)return[]
  const candidates:AwardNeighborSearch[]=[]
  const topNaics=profile.naicsCodes[0]
  const topPsc=profile.pscCodes[0]
  const terms=profile.keywords.slice(0,4)

  if(topPsc&&terms.length){
    candidates.push({
      naicsCodes:topNaics?[topNaics]:[],
      pscCodes:[topPsc],
      keywords:terms.slice(0,2),
      seedProviderIds:profile.seedProviderIds,
      reason:'Prior federal winners share this PSC/capability cluster.',
    })
  }
  if(topNaics&&terms.length){
    candidates.push({
      naicsCodes:[topNaics],
      pscCodes:[],
      keywords:terms.slice(0,2),
      seedProviderIds:profile.seedProviderIds,
      reason:'Prior federal winners share this NAICS/capability cluster.',
    })
  }
  if(profile.naicsCodes.length>1){
    candidates.push({
      naicsCodes:profile.naicsCodes.slice(0,2),
      pscCodes:profile.pscCodes.slice(0,1),
      keywords:terms.slice(0,1),
      seedProviderIds:profile.seedProviderIds,
      reason:'Prior winners form an adjacent NAICS/PSC cluster.',
    })
  }

  const seen=new Set<string>()
  return candidates.filter(candidate=>{
    const signature=JSON.stringify([candidate.naicsCodes,candidate.pscCodes,candidate.keywords])
    if(seen.has(signature))return false
    seen.add(signature)
    return candidate.naicsCodes.length>0||candidate.pscCodes.length>0||candidate.keywords.length>0
  }).slice(0,Math.max(1,Math.min(Math.floor(maxQueries),6)))
}

export function isAwardNeighborEvidence(provider:BrokerProviderCandidate){
  return provider.evidence.some(evidence => {
    const seedProviderIds=evidence.details?.seedProviderIds
    return evidence.details?.discoveryMode === 'award_neighbor' &&
      Array.isArray(seedProviderIds) &&
      seedProviderIds.length>0
  })
}
