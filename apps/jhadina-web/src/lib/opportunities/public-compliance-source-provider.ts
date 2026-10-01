import {
  assessPublicComplianceSearchResult,
  buildPublicComplianceDiscoveryQueries,
  complianceTopicCoverage,
  type PublicComplianceSearchResult,
  type PublicComplianceSourceCandidate,
  type UsStateOrDcCode,
} from '@jhadina/opportunity-core'

type SearchRow={title?:unknown;url?:unknown;snippet?:unknown;publishedAt?:unknown;text?:unknown;highlights?:unknown}

const clean=(value:unknown)=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const uniq=<T>(values:T[])=>[...new Set(values)]

function safeHttpUrl(raw:string){
  try{
    const u=new URL(raw)
    if(!['http:','https:'].includes(u.protocol))return undefined
    const host=u.hostname.toLowerCase()
    if(['localhost','127.0.0.1','0.0.0.0','::1'].includes(host))return undefined
    return u.toString()
  }catch{return undefined}
}

function normalizeRows(payload:unknown,provider:'web_search'|'exa',now:string):PublicComplianceSearchResult[]{
  if(!payload||typeof payload!=='object')return[]
  const root=payload as Record<string,unknown>
  const raw=Array.isArray(root.results)?root.results:[]
  const out:PublicComplianceSearchResult[]=[]
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

async function searchGeneric(query:string,limit:number,fetchImpl:typeof fetch,now:string){
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
  if(!response.ok)throw new Error(`PUBLIC_COMPLIANCE_WEB_SEARCH_HTTP_${response.status}`)
  return normalizeRows(await response.json(),'web_search',now).slice(0,limit)
}

async function searchExa(query:string,limit:number,fetchImpl:typeof fetch,now:string){
  const apiKey=process.env.EXA_API_KEY?.trim()
  if(!apiKey)return undefined
  const response=await fetchImpl('https://api.exa.ai/search',{
    method:'POST',
    headers:{'content-type':'application/json',accept:'application/json','x-api-key':apiKey},
    body:JSON.stringify({query,type:'auto',numResults:limit,contents:{highlights:true}}),
    cache:'no-store',
    signal:AbortSignal.timeout(20_000),
  })
  if(!response.ok)throw new Error(`PUBLIC_COMPLIANCE_EXA_HTTP_${response.status}`)
  return normalizeRows(await response.json(),'exa',now).slice(0,limit)
}

export async function discoverPublicComplianceSources(input:{
  state:UsStateOrDcCode
  queryBudget?:number
  maxResultsPerQuery?:number
  fetchImpl?:typeof fetch
  now?:string
}):Promise<{
  candidates:PublicComplianceSourceCandidate[]
  provider:'web_search'|'exa'
  coverage:ReturnType<typeof complianceTopicCoverage>
}>{
  const now=input.now??new Date().toISOString()
  const fetchImpl=input.fetchImpl??fetch
  const queryBudget=Math.max(1,Math.min(input.queryBudget??2,3))
  const limit=Math.max(1,Math.min(input.maxResultsPerQuery??8,20))
  const queries=buildPublicComplianceDiscoveryQueries(input.state).slice(0,queryBudget)
  const results:PublicComplianceSearchResult[]=[]
  let provider:'web_search'|'exa'|undefined

  for(const query of queries){
    const generic=await searchGeneric(query,limit,fetchImpl,now)
    if(generic){
      provider='web_search'
      results.push(...generic)
      continue
    }
    const exa=await searchExa(query,limit,fetchImpl,now)
    if(exa){
      provider='exa'
      results.push(...exa)
      continue
    }
    throw new Error('PUBLIC_COMPLIANCE_SEARCH_NOT_CONFIGURED')
  }

  const seen=new Set<string>()
  const candidates=uniq(results.map(row=>row.url)).flatMap(url=>{
    if(seen.has(url))return[]
    seen.add(url)
    const result=results.find(row=>row.url===url)
    return result?[assessPublicComplianceSearchResult({state:input.state,result})]:[]
  }).sort((a,b)=>b.confidence-a.confidence||a.sourceUrl.localeCompare(b.sourceUrl))

  return {candidates,provider:provider??'web_search',coverage:complianceTopicCoverage(candidates)}
}
