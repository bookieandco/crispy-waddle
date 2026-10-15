/**
 * Read-only reference-inspired GEO/AEO and SERP observations.
 * Provider markers are DESCRIPTIVE, not proof of API authorization.
 * Browser observations must always be marked MANUAL_UNVERIFIED.
 * No ranking claims, crawler, spend, outreach, publishing or game XP.
 */
export type ResearchSource = 'MANUAL_UNVERIFIED' | 'DEMO' | 'PROVIDER_REPORTED'
export type AiEngine = 'chatgpt' | 'gemini' | 'perplexity' | 'copilot' | 'google_ai_mode'
export interface AiAnswerObservation {
  id: string
  engine: AiEngine
  prompt: string
  market: string
  observedAt: string
  sourceRef: string
  source: ResearchSource
  answer: string
  citations: string[]
}
export interface AiVisibilityReview {
  totalSamples: number
  brandMentionSamples: number
  ownedSiteCitationSamples: number
  outsideCitationDomains: string[]
  evidenceRefs: string[]
  observationsAreSampledNotRankings: true
  noRevenueOrXp: true
  publishingAuthorized: false
  automatedOutreachAuthorized: false
  externalActionAuthorized: false
}
const truthy = (s: string, tag: string, max = 2000): string => {
  if (typeof s !== 'string' || !s.trim() || s.length > max) throw new Error('GROWTH_RESEARCH_' + tag)
  return s.trim()
}
const stamp = (s: string): number => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(s) || !Number.isFinite(Date.parse(s))) {
    throw new Error('GROWTH_RESEARCH_BAD_TIMESTAMP')
  }
  return Date.parse(s)
}
const host = (s: string): string => {
  let u: URL
  try { u = new URL(s) } catch { throw new Error('GROWTH_RESEARCH_INVALID_URL') }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) throw new Error('GROWTH_RESEARCH_INVALID_URL')
  return u.hostname.toLowerCase().replace(/^www\./, '')
}
const isOwned = (s: string, site: string): boolean => {
  const h = host(s), base = host(site)
  return h === base || h.endsWith('.' + base)
}
function mention(answer: string, candidate: string): boolean {
  const clean = candidate.toLowerCase()
  // Search is advisory: appearance in sample text isn't evidence of recommendation.
  const words = answer.toLowerCase()
  let index = words.indexOf(clean)
  while (index !== -1) {
    const before = words[index - 1], after = words[index + clean.length]
    if ((!before || !/[\p{L}\p{N}]/u.test(before)) &&
        (!after || !/[\p{L}\p{N}]/u.test(after))) return true
    index = words.indexOf(clean, index + 1)
  }
  return false
}
export function reviewAiVisibilitySamples(input: {
  site: string
  brand: string
  aliases?: string[]
  now: string
  observations: AiAnswerObservation[]
}): AiVisibilityReview {
  host(input.site)
  const brand = truthy(input.brand, 'BRAND_REQUIRED', 120)
  const now = stamp(input.now)
  const aliases = (input.aliases ?? []).map(a => truthy(a, 'ALIAS_INVALID', 120))
  if (!Array.isArray(input.observations) || input.observations.length > 100) throw new Error('GROWTH_RESEARCH_TOO_MANY_SAMPLES')
  const ids = new Set<string>(), outside = new Set<string>(), refs = new Set<string>()
  let mentions = 0, owned = 0
  for (const row of input.observations) {
    truthy(row.id, 'ID_REQUIRED', 200)
    if (ids.has(row.id)) throw new Error('GROWTH_RESEARCH_DUPLICATE_SAMPLE')
    ids.add(row.id)
    truthy(row.prompt, 'PROMPT_REQUIRED', 500)
    truthy(row.market, 'MARKET_REQUIRED', 80)
    truthy(row.sourceRef, 'SOURCE_REF_REQUIRED', 300)
    truthy(row.answer, 'ANSWER_REQUIRED', 40000)
    if (!['chatgpt','gemini','perplexity','copilot','google_ai_mode'].includes(row.engine) ||
      !['MANUAL_UNVERIFIED','DEMO','PROVIDER_REPORTED'].includes(row.source)) {
      throw new Error('GROWTH_RESEARCH_SOURCE_OR_ENGINE_INVALID')
    }
    const at = stamp(row.observedAt)
    if (at > now || at < now - 90 * 86400000) throw new Error('GROWTH_RESEARCH_SAMPLE_STALE')
    if (!Array.isArray(row.citations) || row.citations.length > 25) throw new Error('GROWTH_RESEARCH_TOO_MANY_CITATIONS')
    if ([brand, ...aliases].some(n => mention(row.answer, n))) mentions++
    if (row.citations.some(c => isOwned(c, input.site))) owned++
    for (const citation of row.citations) if (!isOwned(citation, input.site)) outside.add(host(citation))
    refs.add(row.sourceRef)
  }
  return {
    totalSamples:input.observations.length,
    brandMentionSamples: mentions,
    ownedSiteCitationSamples: owned,
    outsideCitationDomains:[...outside].sort(),
    evidenceRefs:[...refs].sort(),
    observationsAreSampledNotRankings:true,noRevenueOrXp:true,
    publishingAuthorized:false,automatedOutreachAuthorized:false,
    externalActionAuthorized:false,
  }
}
export interface SerpResearchSnapshot {
  query: string
  market: string
  observedAt: string
  source: ResearchSource
  sourceRef: string
  organic: Array<{ url:string; position:number }>
  peopleAlsoAsk: string[]
  relatedSearches: string[]
}
export interface BuyerIntentReview {
  query:string
  intent:'TRANSACTIONAL'|'COMMERCIAL'|'INFORMATIONAL'|'UNKNOWN'
  existingOwnedPageUrls:string[]
  unverifiedCompetitorDomains:string[]
  buyerQuestions:string[]
  action:'OPTIMIZE_EXISTING_REVIEW'|'EVALUATE_NEW_BRIEF'|'RESEARCH_ONLY'
  sourceTrust:'REPORTED_NOT_CERTIFIED'|'UNVERIFIED'
  evidenceRefs:string[]
  evidenceIsNotAuthority:true
  canPublish:false
  earnedXp:0
}
function inferredIntent(q:string): BuyerIntentReview['intent'] {
  if (/\b(buy|order|purchase|shop|price|quote|near me)\b/i.test(q)) return 'TRANSACTIONAL'
  if (/\b(best|vs|versus|compare|alternative|review|custom|personalized)\b/i.test(q)) return 'COMMERCIAL'
  if (/\b(what|how|why|when|tips|guide|tutorial)\b/i.test(q)) return 'INFORMATIONAL'
  return 'UNKNOWN'
}
export function reviewSerpBuyerIntent(input: {
  site:string
  now:string
  snapshot:SerpResearchSnapshot
  ownedPages:string[]
  validatedOfferIds:string[]
}): BuyerIntentReview {
  host(input.site)
  const now=stamp(input.now), row=input.snapshot
  truthy(row.query,'QUERY_REQUIRED',350)
  truthy(row.market,'MARKET_REQUIRED',80)
  truthy(row.sourceRef,'SOURCE_REF_REQUIRED',300)
  if(!['MANUAL_UNVERIFIED','DEMO','PROVIDER_REPORTED'].includes(row.source)) throw new Error('GROWTH_RESEARCH_SOURCE_INVALID')
  if(stamp(row.observedAt)>now || stamp(row.observedAt)<now-30*86400000) throw new Error('GROWTH_RESEARCH_SERP_STALE')
  if(!Array.isArray(row.organic) || row.organic.length>30 ||
    !Array.isArray(row.peopleAlsoAsk) || row.peopleAlsoAsk.length>20 ||
    !Array.isArray(row.relatedSearches) || row.relatedSearches.length>20 ||
    !Array.isArray(input.ownedPages) || input.ownedPages.length>500) throw new Error('GROWTH_RESEARCH_SERP_LIMIT')
  if(input.ownedPages.some(p=>!isOwned(p,input.site))) throw new Error('GROWTH_RESEARCH_CROSS_VENTURE_PAGE')
  const slots=new Set<number>(), own=new Set<string>(), rival=new Set<string>()
  for(const result of row.organic) {
    if(!Number.isInteger(result.position) || result.position<1 || slots.has(result.position))throw new Error('GROWTH_RESEARCH_SERP_POSITION_INVALID')
    slots.add(result.position)
    if(isOwned(result.url,input.site))own.add(result.url)
    else rival.add(host(result.url))
  }
  const intent=inferredIntent(row.query)
  const hasOffers=input.validatedOfferIds.some(s=>typeof s==='string' && !!s.trim())
  const action:BuyerIntentReview['action']=own.size>0?'OPTIMIZE_EXISTING_REVIEW':
    row.source==='PROVIDER_REPORTED' && hasOffers && ['COMMERCIAL','TRANSACTIONAL'].includes(intent)
    ?'EVALUATE_NEW_BRIEF':'RESEARCH_ONLY'
  return {
    query:row.query,intent,
    existingOwnedPageUrls:[...own].sort(),
    unverifiedCompetitorDomains:[...rival].sort(),
    buyerQuestions:[...new Set(row.peopleAlsoAsk.map(p=>truthy(p,'PAA_INVALID',500)))].slice(0,10),
    action,sourceTrust:row.source==='PROVIDER_REPORTED'?'REPORTED_NOT_CERTIFIED':'UNVERIFIED',
    evidenceRefs:[row.sourceRef],evidenceIsNotAuthority:true,canPublish:false,earnedXp:0,
  }
}
