import 'server-only'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { request } from 'node:https'
import { auditObservedInternalLinks, inspectOwnedWebsite,
  type LinkPageObservation } from '@jhadina/growth-core'

/**
 * JH-PERSONAL-SEO.03/.05: real, bounded HTTPS inspection of a SERVER-REGISTERED
 * owner site. HTTPS sockets use a pinned, prevalidated public DNS address.
 * No caller-controlled arbitrary URL scans, no cross-origin redirects.
 */
export type PersonalSeoCrawl = {
  website: string; checkedAt: string; pages: LinkPageObservation[]
  diagnostics: ReturnType<typeof inspectOwnedWebsite>
  links: ReturnType<typeof auditObservedInternalLinks>
  sitemapUrlsDiscovered: number
  source: 'OWNER_REGISTERED_PINNED_HTTPS_CRAWL'
  completeSiteCoverage: false; externalActionAuthorized: false
}
type TextResult = { status: number; body: string; url: string }
type SafeRead = (url: string, limitBytes: number) => Promise<TextResult>

function validSite(value: string): URL {
  const parsed = new URL(value)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port ||
    parsed.hostname === 'localhost' || parsed.hostname.endsWith('.local') ||
    parsed.hostname.endsWith('.internal') || isIP(parsed.hostname) !== 0 ||
    !/^[a-z0-9.-]+$/i.test(parsed.hostname) || !parsed.hostname.includes('.')) {
    throw new Error('PERSONAL_SEO_PUBLIC_HTTPS_DOMAIN_REQUIRED')
  }
  parsed.hash = ''
  return parsed
}
function isPublic(ip: string): boolean {
  if (isIP(ip) === 4) {
    const parts = ip.split('.').map(Number)
    const [a,b] = parts
    return a !== 0 && a !== 10 && a !== 127 && a !== 255 &&
      !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) &&
      !(a === 192 && (b === 168 || b === 0)) &&
      !(a === 100 && b >= 64 && b <= 127) &&
      !(a === 198 && (b === 18 || b === 19 || b === 51)) &&
      !(a === 203 && b === 0) && a! >= 1 && a! <= 223
  }
  if (isIP(ip) === 6) {
    const lower=ip.toLowerCase()
    return !['::', '::1'].includes(lower) &&
      !lower.startsWith('fc') && !lower.startsWith('fd') &&
      !lower.startsWith('fe') && !lower.startsWith('ff') &&
      !lower.startsWith('2001:db8:') &&
      !lower.includes('ffff:')
  }
  return false
}
function sameHost(root: URL, candidate: string): URL {
  const url = validSite(new URL(candidate, root).toString())
  if (url.origin !== root.origin) throw new Error('PERSONAL_SEO_CROSS_ORIGIN_BLOCKED')
  return url
}
async function pinnedHttps(url: string, maxBytes: number): Promise<TextResult> {
  const root=validSite(url)
  const addresses=await lookup(root.hostname, {all:true,verbatim:true})
  if (!addresses.length || addresses.some(row=>!isPublic(row.address)))
    throw new Error('PERSONAL_SEO_UNSAFE_DNS')
  const chosen=addresses[0]!
  return new Promise<TextResult>((resolve,reject)=>{
    const req=request(root, {
      method:'GET', timeout:6500, maxHeaderSize:16_384,
      headers:{'user-agent':'JhadinaPersonalSEO/1.0 (owned site audit)','accept':'text/html,application/xml,text/xml,text/plain'},
      lookup:(_hostname,_options,callback)=>callback(null,chosen.address,chosen.family),
    },res=>{
      let bytes=0;const chunks:Buffer[]=[]
      res.on('data',(chunk:Buffer)=>{
        bytes+=chunk.length
        if (bytes>maxBytes) { req.destroy(new Error('PERSONAL_SEO_BODY_TOO_LARGE'));return }
        chunks.push(Buffer.from(chunk))
      })
      res.on('end',()=>{
        const status=res.statusCode ?? 0
        // Refuse redirects rather than silently follow cross-site or IP changes.
        if (status >= 300 && status < 400)
          return reject(new Error('PERSONAL_SEO_REDIRECT_REQUIRES_REVIEW'))
        resolve({status,body:Buffer.concat(chunks).toString('utf8'),url:root.toString()})
      })
      res.on('error',reject)
    })
    req.on('timeout',()=>req.destroy(new Error('PERSONAL_SEO_TIMEOUT')))
    req.on('error',reject)
    req.end()
  })
}
function robotsAllowed(body: string, pathname: string): boolean {
  let applies=false;let rules:Array<{allowed:boolean;path:string}>=[]
  // Conservative small robots parser for User-agent: * and this crawler.
  for(const raw of body.split(/\r?\n/).slice(0,1500)) {
    const line=raw.split('#')[0]!.trim()
    const ua=/^user-agent:\s*(.+)$/i.exec(line)
    if(ua){const agent=ua[1]!.toLowerCase().trim()
      applies=agent==='*'||agent.includes('jhadinapersonalseo')
      continue
    }
    if(!applies)continue
    const row=/^(allow|disallow):\s*(.*)$/i.exec(line)
    if(row && row[2]) rules.push({allowed:row[1]!.toLowerCase()==='allow',path:row[2]!})
  }
  rules=rules.filter(rule=>pathname.startsWith(rule.path.replace(/\*/g,'')))
  rules.sort((a,b)=>b.path.length-a.path.length||Number(b.allowed)-Number(a.allowed))
  return rules[0]?.allowed ?? true
}
const decodeEntities=(s:string)=>s.replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
function attr(html:string,name:string):string|undefined {
  const hit=new RegExp('\\b'+name+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27)','i').exec(html)
  return hit?decodeEntities(hit[1]??hit[2]??''):undefined
}
function extract(url:string,status:number,html:string,now:string):LinkPageObservation {
  const title=/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/<[^>]+>/g,'').trim()
  const metas=[...html.matchAll(/<meta\b[^>]*>/gi)].map(x=>x[0])
  const links=[...html.matchAll(/<link\b[^>]*>/gi)].map(x=>x[0])
  const description=metas.find(m=>attr(m,'name')?.toLowerCase()==='description')
  const robots=metas.find(m=>attr(m,'name')?.toLowerCase()==='robots')
  const canonical=links.find(m=>attr(m,'rel')?.toLowerCase().split(/\s+/).includes('canonical'))
  const schemaTypes=Array.from(new Set([...html.matchAll(/"@type"\s*:\s*"([^"]{1,70})"/gi)]
    .map(m=>m[1]!))).slice(0,20)
  const outgoingLinks=[...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].slice(0,100).flatMap(match=>{
    const href=attr(match[0],'href')
    const anchorText=decodeEntities((match[1]??'').replace(/<[^>]*>/g,'')).trim()
    // Ignore non-navigation javascript/data/blob pseudo-links in real sites.
    // They cannot be HTTP crawl targets and must not poison the site audit.
    return href && !/^(javascript:|data:|blob:)/i.test(href.trim())?[{href,anchorText}]:[]
  })
  return {
    url,responseStatus:status,title,description:description?attr(description,'content'):undefined,
    canonicalUrl:canonical?attr(canonical,'href'):undefined,
    noindex:/\bnoindex\b/i.test(robots?attr(robots,'content')??'':''),
    schemaTypes,outgoingLinks,evidenceRef:'crawl:'+encodeURIComponent(url)+':'+now,
    inspectedAt:now,
  }
}
export async function crawlRegisteredOwnedSite(input:{
  registeredWebsite:string; now?:string; maxPages?:number; read?:SafeRead
}):Promise<PersonalSeoCrawl>{
  const root=validSite(input.registeredWebsite)
  const maxPages=input.maxPages??10
  if(!Number.isInteger(maxPages)||maxPages<1||maxPages>25)
    throw new Error('PERSONAL_SEO_PAGE_BUDGET_INVALID')
  const read=input.read??pinnedHttps
  const now=input.now??new Date().toISOString()
  if(!Number.isFinite(Date.parse(now)))throw new Error('PERSONAL_SEO_TIME_INVALID')
  // Fail closed: without readable robots policy, do not crawl HTML.
  const robots=await read(new URL('/robots.txt',root).toString(),128_000)
  if(robots.status!==200) throw new Error('PERSONAL_SEO_ROBOTS_UNAVAILABLE')
  const discovered:string[]=[root.toString()]
  let sitemapUrlsDiscovered=0
  if(robotsAllowed(robots.body,'/sitemap.xml')){
    try {
      const sitemap=await read(new URL('/sitemap.xml',root).toString(),512_000)
      if(sitemap.status===200){
        for(const match of sitemap.body.matchAll(/<loc>\s*([^<]{1,1800})\s*<\/loc>/gi)){
          if(discovered.length>=maxPages*3)break
          // Reject a foreign sitemap URL without aborting safe same-origin entries.
          try {
            const candidate=sameHost(root,decodeEntities(match[1]!.trim()))
            if(!candidate.pathname.endsWith('.xml') && !discovered.includes(candidate.toString())){
              discovered.push(candidate.toString())
              sitemapUrlsDiscovered++
            }
          } catch { /* cross-origin or malformed URL is dropped, never fetched */ }
        }
      }
    }catch { /* optional sitemap is not authorization */ }
  }
  const pages:LinkPageObservation[]=[];const visited=new Set<string>()
  for(const requested of discovered){
    if(pages.length>=maxPages)break
    const page=sameHost(root,requested)
    if(visited.has(page.toString()))continue
    visited.add(page.toString())
    if(!robotsAllowed(robots.body,page.pathname))continue
    try{
      const result=await read(page.toString(),1_000_000)
      if(result.status<100||result.status>599)continue
      pages.push(extract(page.toString(),result.status,result.body,now))
    }catch { /* incomplete coverage remains explicit; never fabricate a 404 */ }
  }
  const diagnostics=inspectOwnedWebsite({website:root.toString(),observations:pages})
  const links=auditObservedInternalLinks({website:root.toString(),observations:pages,observedAt:now})
  return {website:root.toString(),checkedAt:now,pages,diagnostics,links,
    sitemapUrlsDiscovered,source:'OWNER_REGISTERED_PINNED_HTTPS_CRAWL',
    completeSiteCoverage:false,externalActionAuthorized:false}
}
