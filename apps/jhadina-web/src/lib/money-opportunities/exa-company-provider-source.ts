import type { BrokerProviderCandidate } from '@jhadina/opportunity-core'

const EXA_SEARCH_URL='https://api.exa.ai/search'
const EXA_DOC_URL='https://exa.ai/docs/reference/search'

const uniq=(values:string[])=>[...new Set(values.map(value=>value.trim()).filter(Boolean))]
const text=(value:unknown)=>typeof value==='string'?value.trim():''

function providerName(title:string,url:string){
  const cleaned=title
    .replace(/\s+(official\s+(?:site|website)|homepage)\s*$/i,'')
    .split(/\s+[|—–]\s+/)[0]
    .trim()
  if(cleaned)return cleaned
  try{return new URL(url).hostname.replace(/^www\./,'')}catch{return url}
}

function resultHighlights(row:Record<string,unknown>){
  const highlights=row.highlights
  if(Array.isArray(highlights))return highlights.filter((value):value is string=>typeof value==='string')
  if(typeof highlights==='string')return[highlights]
  return[]
}

export function parseExaCompanyProviders(body:unknown,query:string,limit=20):BrokerProviderCandidate[]{
  if(!body||typeof body!=='object')return[]
  const root=body as Record<string,unknown>
  const results=Array.isArray(root.results)?root.results:[]
  const out:BrokerProviderCandidate[]=[]
  for(const value of results){
    if(!value||typeof value!=='object')continue
    const row=value as Record<string,unknown>
    const url=text(row.url)
    if(!url||!/^https?:\/\//i.test(url))continue
    const title=text(row.title)
    const legalName=providerName(title,url)
    if(!legalName)continue
    const id=text(row.id)||url
    const highlights=resultHighlights(row)
    const pageText=text(row.text).slice(0,3000)
    out.push({
      id:'provider:exa:'+id.replace(/[^a-z0-9]+/gi,'').slice(0,120),
      legalName,
      naicsCodes:[],
      keywords:uniq([legalName,...highlights,pageText]),
      evidence:[{
        id:'exa:'+id,
        source:'web_search',
        url,
        details:{
          query,
          resultTitle:title||null,
          targetCountry:'US',
          countryVerified:false,
          identityVerified:false,
          naicsVerified:false,
          capabilityEvidence:'web_discovery_only',
          sourceDocumentation:EXA_DOC_URL,
        },
      }],
    })
    if(out.length>=Math.max(1,Math.min(Math.floor(limit),100)))break
  }
  return out
}

export async function searchExaCompanyProviders(input:{
  keywords:string[]
  naicsCodes?:string[]
  geography?:string
  limit?:number
}):Promise<BrokerProviderCandidate[]>{
  const apiKey=process.env.EXA_API_KEY?.trim()
  if(!apiKey)return[]
  const keywords=uniq(input.keywords).slice(0,6)
  if(!keywords.length)return[]
  const naics=uniq(input.naicsCodes??[]).slice(0,3)
  const query=[
    'United States company supplier contractor manufacturer distributor service provider',
    keywords.join(' '),
    naics.length?'NAICS '+naics.join(' '):'',
    input.geography??'',
    'official company website capabilities',
  ].filter(Boolean).join(' ')
  const limit=Math.max(1,Math.min(Math.floor(input.limit??12),25))
  const response=await fetch(EXA_SEARCH_URL,{
    method:'POST',
    headers:{
      'content-type':'application/json',
      accept:'application/json',
      'x-api-key':apiKey,
    },
    body:JSON.stringify({
      query,
      type:'auto',
      numResults:limit,
      contents:{highlights:true},
    }),
    cache:'no-store',
    signal:AbortSignal.timeout(20000),
  })
  if(!response.ok)throw new Error('EXA_SEARCH_HTTP_'+response.status)
  return parseExaCompanyProviders(await response.json(),query,limit)
}
