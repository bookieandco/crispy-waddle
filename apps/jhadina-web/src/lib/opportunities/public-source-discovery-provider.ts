import {
  assessPublicSourceSearchResult,
  extractOfficialProcurementLinks,
  isGovernmentProcurementDomain,
  isJurisdictionOfficialDomain,
  type PublicJurisdictionDescriptor,
  type PublicProcurementSourceCandidate,
  type PublicSourceDiscoveryProvider,
  type PublicSourceSearchResult,
} from '@jhadina/opportunity-core'

type SearchRow={title?:unknown;url?:unknown;snippet?:unknown;publishedAt?:unknown;text?:unknown;highlights?:unknown}

const clean=(value:unknown)=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const uniq=<T>(values:T[])=>[...new Set(values)]

function safeHttpUrl(raw:string):string|undefined{
  try{
    const u=new URL(raw)
    if(u.protocol!=='https:'&&u.protocol!=='http:')return undefined
    const host=u.hostname.toLowerCase()
    if(['localhost','127.0.0.1','0.0.0.0','::1'].includes(host))return undefined
    return u.toString()
  }catch{return undefined}
}

function normalizeRows(payload:unknown,provider:PublicSourceDiscoveryProvider,now:string):PublicSourceSearchResult[]{
  if(!payload||typeof payload!=='object')return[]
  const root=payload as Record<string,unknown>
  const raw=Array.isArray(root.results)?root.results:[]
  const out:PublicSourceSearchResult[]=[]
  for(const value of raw){
    if(!value||typeof value!=='object')continue
    const row=value as SearchRow
    const url=safeHttpUrl(clean(row.url))
    if(!url)continue
    const highlights=Array.isArray(row.highlights)?row.highlights.filter((v):v is string=>typeof v==='string').join(' '):clean(row.highlights)
    out.push({
      title:clean(row.title)||new URL(url).hostname,
      url,
      snippet:clean(row.snippet)||highlights||clean(row.text).slice(0,1000),
      provider,
      observedAt:clean(row.publishedAt)||now,
    })
  }
  return out
}

async function genericWebSearch(query:string,maxResults:number,fetchImpl:typeof fetch,now:string){
  const endpoint=process.env.WEB_SEARCH_URL?.trim()
  const apiKey=process.env.WEB_SEARCH_API_KEY?.trim()
  if(!endpoint||!apiKey)return undefined
  const url=new URL(endpoint)
  url.searchParams.set('q',query)
  url.searchParams.set('freshness','3650')
  const response=await fetchImpl(url,{
    headers:{authorization:`Bearer ${apiKey}`,accept:'application/json'},
    cache:'no-store',
    signal:AbortSignal.timeout(20_000),
  })
  if(!response.ok)throw new Error(`PUBLIC_SOURCE_WEB_SEARCH_HTTP_${response.status}`)
  return normalizeRows(await response.json(),'web_search',now).slice(0,maxResults)
}

async function exaSearch(query:string,maxResults:number,fetchImpl:typeof fetch,now:string){
  const apiKey=process.env.EXA_API_KEY?.trim()
  if(!apiKey)return undefined
  const response=await fetchImpl('https://api.exa.ai/search',{
    method:'POST',
    headers:{'content-type':'application/json',accept:'application/json','x-api-key':apiKey},
    body:JSON.stringify({query,type:'auto',numResults:maxResults,contents:{highlights:true}}),
    cache:'no-store',
    signal:AbortSignal.timeout(20_000),
  })
  if(!response.ok)throw new Error(`PUBLIC_SOURCE_EXA_HTTP_${response.status}`)
  return normalizeRows(await response.json(),'exa',now).slice(0,maxResults)
}

export async function searchPublicProcurementSources(input:{
  jurisdiction:PublicJurisdictionDescriptor
  queries:string[]
  maxResultsPerQuery?:number
  queryBudget?:number
  fetchImpl?:typeof fetch
  now?:string
}):Promise<{provider:PublicSourceDiscoveryProvider;results:PublicSourceSearchResult[]}>{
  const fetchImpl=input.fetchImpl??fetch
  const now=input.now??new Date().toISOString()
  const maxResults=Math.max(1,Math.min(input.maxResultsPerQuery??8,20))
  const queryBudget=Math.max(1,Math.min(input.queryBudget??2,3))
  const queries=uniq(input.queries.map(q=>q.trim()).filter(Boolean)).slice(0,queryBudget)
  if(!queries.length)throw new Error('PUBLIC_SOURCE_SEARCH_QUERY_EMPTY')

  const all:PublicSourceSearchResult[]=[]
  let provider:PublicSourceDiscoveryProvider|undefined
  for(const query of queries){
    const generic=await genericWebSearch(query,maxResults,fetchImpl,now)
    if(generic){
      provider='web_search'
      all.push(...generic)
      continue
    }
    const exa=await exaSearch(query,maxResults,fetchImpl,now)
    if(exa){
      provider='exa'
      all.push(...exa)
      continue
    }
    throw new Error('PUBLIC_SOURCE_SEARCH_NOT_CONFIGURED')
  }
  const seen=new Set<string>()
  return {
    provider:provider??'web_search',
    results:all.filter(row=>{
      if(seen.has(row.url))return false
      seen.add(row.url)
      return true
    }),
  }
}

async function fetchOfficialHtml(url:string,fetchImpl:typeof fetch):Promise<string|undefined>{
  if(!isGovernmentProcurementDomain(url))return undefined
  const response=await fetchImpl(url,{
    headers:{accept:'text/html','user-agent':'Jhadina-Public-Source-Discovery/1.0'},
    cache:'no-store',
    redirect:'follow',
    signal:AbortSignal.timeout(15_000),
  })
  if(!response.ok)return undefined
  const contentType=response.headers.get('content-type')??''
  if(!contentType.toLowerCase().includes('text/html'))return undefined
  return (await response.text()).slice(0,2_000_000)
}

export async function discoverPublicProcurementCandidates(input:{
  jurisdiction:PublicJurisdictionDescriptor
  queries:string[]
  maxResultsPerQuery?:number
  queryBudget?:number
  fetchImpl?:typeof fetch
  now?:string
}):Promise<PublicProcurementSourceCandidate[]>{
  const fetchImpl=input.fetchImpl??fetch
  const now=input.now??new Date().toISOString()
  const search=await searchPublicProcurementSources({...input,fetchImpl,now})
  const direct=search.results.map(result=>assessPublicSourceSearchResult({jurisdiction:input.jurisdiction,result}))
  const linked:PublicProcurementSourceCandidate[]=[]

  for(const candidate of direct.filter(c=>c.status==='official_owner_verified').slice(0,4)){
    const html=await fetchOfficialHtml(candidate.sourceUrl,fetchImpl)
    if(!html)continue
    const evidenceRef=`official-page:${input.jurisdiction.id}:${candidate.sourceUrl}:${now}`
    const links=extractOfficialProcurementLinks({officialPageUrl:candidate.sourceUrl,html,evidenceRef})
    for(const link of links.slice(0,25)){
      const synthetic:PublicSourceSearchResult={
        title:link.anchorText||new URL(link.linkedUrl).hostname,
        url:link.linkedUrl,
        snippet:`${input.jurisdiction.name} procurement vendor portal contract opportunities`,
        provider:search.provider,
        observedAt:now,
      }
      linked.push(assessPublicSourceSearchResult({
        jurisdiction:input.jurisdiction,
        result:synthetic,
        officialLinkEvidence:link,
      }))
    }
  }

  const byUrl=new Map<string,PublicProcurementSourceCandidate>()
  for(const candidate of [...direct,...linked]){
    const current=byUrl.get(candidate.sourceUrl)
    if(!current||candidate.confidence>current.confidence)byUrl.set(candidate.sourceUrl,candidate)
  }
  return [...byUrl.values()].sort((a,b)=>b.confidence-a.confidence||a.sourceUrl.localeCompare(b.sourceUrl))
}


async function fetchVerifiedOfficialPage(input:{
  url:string
  officialDomainHints:string[]
  fetchImpl:typeof fetch
}):Promise<{html:string;resolvedUrl:string}|undefined>{
  if(!isJurisdictionOfficialDomain(input.url,input.officialDomainHints))return undefined
  const response=await input.fetchImpl(input.url,{
    headers:{accept:'text/html','user-agent':'Jhadina-DotGov-Source-Discovery/1.0'},
    cache:'no-store',
    redirect:'follow',
    signal:AbortSignal.timeout(10_000),
  })
  if(!response.ok)return undefined
  const contentType=response.headers.get('content-type')??''
  if(!contentType.toLowerCase().includes('text/html'))return undefined
  return {
    html:(await response.text()).slice(0,2_000_000),
    resolvedUrl:response.url||input.url,
  }
}

export async function discoverPublicProcurementCandidatesFromOfficialDomains(input:{
  jurisdiction:PublicJurisdictionDescriptor
  domains:string[]
  maxDomains?:number
  fetchImpl?:typeof fetch
  now?:string
}):Promise<PublicProcurementSourceCandidate[]>{
  const fetchImpl=input.fetchImpl??fetch
  const now=input.now??new Date().toISOString()
  const domains=uniq(input.domains.map(domain=>domain.trim().toLowerCase()).filter(Boolean)).slice(0,Math.max(1,Math.min(input.maxDomains??5,10)))
  if(!domains.length)return[]

  const candidates:PublicProcurementSourceCandidate[]=[]
  const visited=new Set<string>()

  const assessLinks=(links:ReturnType<typeof extractOfficialProcurementLinks>,domain:string)=>{
    for(const link of links){
      if(visited.has(link.linkedUrl))continue
      visited.add(link.linkedUrl)
      const synthetic:PublicSourceSearchResult={
        title:link.anchorText||new URL(link.linkedUrl).hostname,
        url:link.linkedUrl,
        snippet:`${input.jurisdiction.name} ${input.jurisdiction.state} ${link.anchorText} procurement purchasing bids solicitations awards contracts vendor portal`,
        provider:'dotgov_registry',
        observedAt:now,
      }
      candidates.push(assessPublicSourceSearchResult({
        jurisdiction:{...input.jurisdiction,officialDomainHints:uniq([...(input.jurisdiction.officialDomainHints??[]),domain])},
        result:synthetic,
        officialLinkEvidence:link,
      }))
    }
  }

  for(const domain of domains){
    const root=`https://${domain}/`
    const page=await fetchVerifiedOfficialPage({
      url:root,
      officialDomainHints:[domain],
      fetchImpl,
    })
    if(!page)continue

    const rootEvidence=`dotgov-registry:${input.jurisdiction.id}:${domain}:${now}`
    const firstLinks=extractOfficialProcurementLinks({
      officialPageUrl:root,
      resolutionBaseUrl:page.resolvedUrl,
      officialDomainHints:[domain],
      html:page.html,
      evidenceRef:rootEvidence,
    }).slice(0,30)
    assessLinks(firstLinks,domain)

    const secondHop=firstLinks
      .filter(link=>isJurisdictionOfficialDomain(link.linkedUrl,[domain]))
      .slice(0,4)
    for(const link of secondHop){
      const second=await fetchVerifiedOfficialPage({
        url:link.linkedUrl,
        officialDomainHints:[domain],
        fetchImpl,
      })
      if(!second)continue
      const nested=extractOfficialProcurementLinks({
        officialPageUrl:link.linkedUrl,
        resolutionBaseUrl:second.resolvedUrl,
        officialDomainHints:[domain],
        html:second.html,
        evidenceRef:`${rootEvidence}:second-hop:${link.linkedUrl}`,
      }).slice(0,30)
      assessLinks(nested,domain)
    }
  }

  const byUrl=new Map<string,PublicProcurementSourceCandidate>()
  for(const candidate of candidates){
    const current=byUrl.get(candidate.sourceUrl)
    if(!current||candidate.confidence>current.confidence)byUrl.set(candidate.sourceUrl,candidate)
  }
  return [...byUrl.values()].sort((a,b)=>b.confidence-a.confidence||a.sourceUrl.localeCompare(b.sourceUrl))
}
