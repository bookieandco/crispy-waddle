import type {GenericAdapterParseResult,GenericPublicSourceDescriptor} from './public-generic-adapters'
import type {PublicOpportunitySignal} from '@jhadina/opportunity-core'

/** Official public RUSD bid-list parser only. Full RFQ/PDF/addenda require planholder access. */
export const RUSD_BIDS_SOURCE_ID='public-source:school_district:unified:0633150:rusd-official-bids-20261022'
const RUSD_ORIGIN='https://webapps.riversideunified.org'
const RUSD_PATH='/apps/planholdersregistration/bidsselect.aspx'
export function isRiversideOfficialBidListSource(source:{id:string;source_url:string;verification_status:string;adapter_kind:string;jurisdiction_id:string}):boolean{
 try{
  const url=new URL(source.source_url)
  return source.id===RUSD_BIDS_SOURCE_ID&&source.jurisdiction_id==='school_district:unified:0633150'&&
   url.origin===RUSD_ORIGIN&&url.pathname.toLowerCase()===RUSD_PATH&&
   !url.username&&!url.password&&!url.search&&!url.hash&&source.adapter_kind==='html'&&
   source.verification_status==='official_owner_verified'
 }catch{return false}
}
function clean(html:string):string{
 return html.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
  .replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim()
}
function laClock(iso:string):string{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',
  month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso))
 const get=(t:string)=>parts.find(x=>x.type===t)?.value??'00'
 return get('year')+'-'+get('month')+'-'+get('day')+'T'+get('hour')+':'+get('minute')+':'+get('second')
}
function deadline(value:string):{date:string;localClock:string}|null{
 const m=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i)
 if(!m)return null
 const month=Number(m[1]),day=Number(m[2]),year=Number(m[3]),hour=Number(m[4]),minute=Number(m[5]),second=Number(m[6]??0)
 if(month<1||month>12||day<1||day>31||hour<1||hour>12||minute>59||second>59)return null
 const calendar=new Date(Date.UTC(year,month-1,day))
 if(calendar.getUTCFullYear()!==year||calendar.getUTCMonth()!==month-1||calendar.getUTCDate()!==day)return null
 const h=(hour%12)+(m[7]?.toUpperCase()==='PM'?12:0)
 const date=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0')
 return {date,localClock:date+'T'+String(h).padStart(2,'0')+':'+String(minute).padStart(2,'0')+':'+String(second).padStart(2,'0')}
}
export function parseRiversideUnifiedPublicBidList(html:string,source:GenericPublicSourceDescriptor,capturedAt:string):GenericAdapterParseResult{
 const signals:PublicOpportunitySignal[]=[]
 const keys=new Set<string>()
 let skippedRows=0
 let structureMatched=false
 const now=laClock(capturedAt)
 for(const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
  const rows=[...(table[1]??'').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
  if(!rows.length)continue
  function cells(row:string):string[]{return [...row.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(x=>clean(x[1]??''))}
  let headers:string[]=[];let headerRow=-1
  for(let i=0;i<Math.min(rows.length,5);i++){
   const c=cells(rows[i]?.[1]??'').map(x=>x.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim())
   if(c.includes('bidid')&&c.includes('project name')&&c.includes('number')&&c.includes('bids to be opened')&&c.includes('status')){
    headers=c;headerRow=i;break
   }
  }
  if(headerRow<0)continue
  structureMatched=true
  const index=(name:string)=>headers.indexOf(name)
  for(const row of rows.slice(headerRow+1)){
   const c=cells(row[1]??'')
   const id=c[index('number')]?.trim(),title=c[index('project name')]?.trim()
   const bidId=c[index('bidid')]?.trim(),status=c[index('status')]?.trim()
   const date=deadline(c[index('bids to be opened')]??'')
   if(!id||!title||!bidId||!/^\d{4}\/\d{2}-\d{2}$/.test(id)||!/^\d+$/.test(bidId)||!date){skippedRows++;continue}
   if(status!=='Accepting Bids'||date.localClock<=now){skippedRows++;continue}
   const externalId='RUSD:'+id
   if(keys.has(externalId)){skippedRows++;continue}
   keys.add(externalId)
   signals.push({
    id:'local:ca:'+encodeURIComponent(source.sourceId)+':'+encodeURIComponent(externalId),
    sourceId:source.sourceId,sourceUrl:source.sourceUrl,sourceName:source.sourceName,
    title,description:'Official RUSD public bid listing only. Full documents and addenda require planholder registration.',
    stage:'open_solicitation',state:'CA',county:'Riverside',locality:'Riverside',
    externalId,deadline:date.date,buyer:'Riverside Unified School District',capturedAt,
    evidenceRef:source.sourceId+':'+encodeURIComponent(externalId)+':'+capturedAt,
   })
  }
 }
 return {parserKey:'rusd-official-html-bids-v1',parserVersion:'1.0.0',signals,structureMatched,skippedRows,
  duplicateExternalIds:0,stableExternalIdCount:signals.length}
}
