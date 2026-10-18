import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'
import { fetchReadOnlyGscSnapshot, fetchOwnedPageSpeed } from '@jhadina/growth-core'
import { crawlRegisteredOwnedSite } from './personal-seo-crawler'

export type PersonalSeoSite = {
  ownerUserId: string; ventureId: string; website: string; gscProperty?: string
}
/** Private server-secret configuration. Never accept site ownership from browser JSON. */
export function registeredPersonalSeoSites(): PersonalSeoSite[] {
  const raw=process.env.JHADINA_PERSONAL_SEO_SITES_JSON
  if(!raw) return []
  let data: unknown
  try{data=JSON.parse(raw)}catch{throw new Error('PERSONAL_SEO_REGISTRY_INVALID')}
  if(!Array.isArray(data)||data.length>12)throw new Error('PERSONAL_SEO_REGISTRY_INVALID')
  const keys=new Set<string>()
  return data.map((row):PersonalSeoSite=>{
    if(!row || typeof row!=='object' || Array.isArray(row))throw new Error('PERSONAL_SEO_SITE_INVALID')
    const v=row as Record<string,unknown>
    if(!['ownerUserId','ventureId','website'].every(k=>typeof v[k]==='string' && !!(v[k] as string).trim()))
      throw new Error('PERSONAL_SEO_SITE_FIELDS_REQUIRED')
    const site={ownerUserId:String(v.ownerUserId),ventureId:String(v.ventureId),
      website:String(v.website),...(typeof v.gscProperty==='string'?{gscProperty:v.gscProperty}:{})}
    const key=site.ownerUserId+':'+site.ventureId
    if(keys.has(key))throw new Error('PERSONAL_SEO_DUPLICATE_REGISTRATION')
    keys.add(key)
    const url=new URL(site.website)
    if(url.protocol!=='https:'||url.username||url.password||url.port||
       url.hostname==='localhost'||!url.hostname.includes('.'))
      throw new Error('PERSONAL_SEO_REGISTERED_SITE_INVALID')
    return site
  })
}
export async function verifyRegisteredPersonalSeoSite(input:{
  ownerUserId:string;ventureId:string
}):Promise<PersonalSeoSite>{
  const site=registeredPersonalSeoSites().find(s=>
    s.ownerUserId===input.ownerUserId && s.ventureId===input.ventureId)
  if(!site)throw new Error('PERSONAL_SEO_SITE_NOT_REGISTERED')
  const db=createServiceRoleClient()
  if(!db)throw new Error('PERSONAL_SEO_STORAGE_NOT_COMMISSIONED')
  const venture=await new VentureRuntimeRepository(db).getVenture(input.ownerUserId,input.ventureId)
  if(!venture || ['killed','archived','paused'].includes(venture.lifecycle))
    throw new Error('PERSONAL_SEO_OWNED_ACTIVE_VENTURE_REQUIRED')
  return site
}
/**
 * Refresh previously owner-consented GOOGLE SEARCH CONSOLE readonly access.
 * Setup occurs outside source control. No access or refresh token is persisted
 * or returned to the browser. Google site verification is repeated in GSC port.
 */
export async function refreshPersonalGscToken(fetchImpl:typeof fetch=fetch):Promise<string>{
  const clientId=process.env.JHADINA_GSC_OAUTH_CLIENT_ID?.trim()
  const clientSecret=process.env.JHADINA_GSC_OAUTH_CLIENT_SECRET?.trim()
  const refreshToken=process.env.JHADINA_GSC_REFRESH_TOKEN?.trim()
  if(!clientId||!clientSecret||!refreshToken)
    throw new Error('PERSONAL_SEO_GSC_OAUTH_NOT_COMMISSIONED')
  const response=await fetchImpl('https://oauth2.googleapis.com/token',{
    method:'POST',cache:'no-store',redirect:'error',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,
      refresh_token:refreshToken,grant_type:'refresh_token'}),
  })
  if(!response.ok)throw new Error('PERSONAL_SEO_GSC_REFRESH_UNAVAILABLE')
  const data=await response.json() as {access_token?:unknown;expires_in?:unknown}
  if(typeof data.access_token!=='string'||!data.access_token.trim()||
    typeof data.expires_in!=='number'||data.expires_in<=0)
    throw new Error('PERSONAL_SEO_GSC_REFRESH_INVALID')
  return data.access_token
}
export async function personalSeoSnapshot(input:{
  ownerUserId:string;ventureId:string;mode:'crawl'|'pagespeed'|'gsc'
  strategy?:'mobile'|'desktop';now?:string;maxPages?:number
}):Promise<Record<string,unknown>>{
  const site=await verifyRegisteredPersonalSeoSite(input)
  const now=input.now??new Date().toISOString()
  if(input.mode==='crawl'){
    const report=await crawlRegisteredOwnedSite({registeredWebsite:site.website,now,maxPages:input.maxPages})
    // Keep raw page body out of the output. Observed metadata and link
    // evidence are bounded by crawler caps; no HTML is ever returned.
    return {mode:'crawl',site:site.website,checkedAt:now,
      diagnostics:report.diagnostics,links:report.links,
      sitemapUrlsDiscovered:report.sitemapUrlsDiscovered,
      source:report.source,coverage:'PARTIAL',externalActionAuthorized:false}
  }
  if(input.mode==='pagespeed'){
    const report=await fetchOwnedPageSpeed({
      businessWebsite:site.website,pageUrl:site.website,
      strategy:input.strategy??'mobile',checkedAt:now,
      serverApiKey:process.env.JHADINA_PAGESPEED_API_KEY,
    })
    return {mode:'pagespeed',site:site.website,report,
      externalActionAuthorized:false}
  }
  if(input.mode==='gsc'){
    if(!site.gscProperty)throw new Error('PERSONAL_SEO_GSC_PROPERTY_NOT_REGISTERED')
    const end=new Date(Date.parse(now)-3*86400000)
    const start=new Date(end.getTime()-27*86400000)
    const token=await refreshPersonalGscToken()
    const report=await fetchReadOnlyGscSnapshot({
      businessWebsite:site.website,property:site.gscProperty,
      startDate:start.toISOString().slice(0,10),
      endDate:end.toISOString().slice(0,10),
      retrievedAt:now,serverAccessToken:token,rowLimit:250,
    })
    return {mode:'gsc',site:site.website,report,
      coverage:'PARTIAL_TOP_ROWS',externalActionAuthorized:false}
  }
  throw new Error('PERSONAL_SEO_MODE_INVALID')
}
