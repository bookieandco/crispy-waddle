import type {GenericAdapterParseResult,GenericPublicSourceDescriptor} from './public-generic-adapters'
import type {PublicOpportunitySignal} from '@jhadina/opportunity-core'

/** Public Oxnard project-announcement table. Does not fetch PlanetBids or planholder docs. */
export const OXNARD_PUBLIC_BIDS_SOURCE_ID=
 'public-source:city:0654652:oxnard-official-public-project-bids-20261022'
const OXNARD_ORIGIN='https://www.oxnard.gov'
const OXNARD_PATH='/finance/purchasing/public-project-bidding'
export function isOxnardPublicProjectBidSource(source:{
 id:string;source_url:string;jurisdiction_id:string;adapter_kind:string;verification_status:string
}):boolean{
 try{
  const url=new URL(source.source_url)
  return source.id===OXNARD_PUBLIC_BIDS_SOURCE_ID&&source.jurisdiction_id==='city:0654652'&&
   url.origin===OXNARD_ORIGIN&&url.pathname.replace(/\/$/,'')===OXNARD_PATH&&
   !url.username&&!url.password&&!url.search&&!url.hash&&source.adapter_kind==='html'&&
   source.verification_status==='official_owner_verified'
 }catch{return false}
}
function clean(x:string):string{
 return x.replace(/<script\b[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]*>/g,' ')
  .replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim()
}
function localToday(iso:string):string{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(iso))
 const get=(key:string)=>parts.find(part=>part.type===key)?.value??'00'
 return get('year')+'-'+get('month')+'-'+get('day')
}
function dueDate(raw:string):string|null{
 const m=raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
 if(!m)return null
 const y=Number(m[3])<100?2000+Number(m[3]):Number(m[3])
 const month=Number(m[1]),day=Number(m[2])
 const d=new Date(Date.UTC(y,month-1,day))
 if(d.getUTCFullYear()!==y||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)return null
 return String(y).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0')
}
function normalized(v:string):string{return v.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function cells(html:string):string[]{
 return [...html.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(v=>clean(v[1]??''))
}
export function parseOxnardPublicProjectBids(
 html:string,source:GenericPublicSourceDescriptor,capturedAt:string
):GenericAdapterParseResult{
 const seen=new Set<string>()
 const signals:PublicOpportunitySignal[]=[]
 let structureMatched=false,skippedRows=0
 const now=localToday(capturedAt)
 for(const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
  const rows=[...(table[1]??'').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
  if(!rows.length)continue
  let cols:string[]=[];let header=-1
  for(let i=0;i<Math.min(5,rows.length);i++){
   const c=cells(rows[i]?.[1]??'').map(normalized)
   const number=c.findIndex(v=>/^specification(?: no| number)?$|^specification$/.test(v))
   const project=c.indexOf('project name')
   const deadline=c.indexOf('bids due date')
   if(number>=0&&project>=0&&deadline>=0){
    cols=c;header=i;break
   }
  }
  if(header<0)continue
  structureMatched=true
  const idAt=cols.findIndex(v=>/^specification(?: no| number)?$|^specification$/.test(v))
  const titleAt=cols.indexOf('project name'),dateAt=cols.indexOf('bids due date')
  for(const row of rows.slice(header+1)){
   const c=cells(row[1]??'')
   const id=(c[idAt]??'').trim(),title=(c[titleAt]??'').trim()
   const due=dueDate(c[dateAt]??'')
   if(!id||!title||!due||due<=now||!/^(?:PW|SD)\s+\d{2}-[0-9A-Za-z-]+$/i.test(id)||
    /\b(cancelled|canceled|withdrawn|awarded|closed)\b/i.test(title)){skippedRows++;continue}
   const externalId='OXNARD:'+id.replace(/\s+/g,' ').toUpperCase()
   if(seen.has(externalId)){skippedRows++;continue}
   seen.add(externalId)
   signals.push({
    id:'local:ca:'+encodeURIComponent(source.sourceId)+':'+encodeURIComponent(externalId),
    sourceId:source.sourceId,sourceUrl:source.sourceUrl,sourceName:source.sourceName,
    title,description:'Oxnard official public-project announcement only. Confirm PlanetBids documents, addenda, registration and deadline times before bid review.',
    stage:'open_solicitation',state:'CA',county:'Ventura',locality:'Oxnard',
    externalId,deadline:due,buyer:'City of Oxnard',capturedAt,
    evidenceRef:source.sourceId+':'+encodeURIComponent(externalId)+':'+capturedAt,
   })
  }
 }
 return {parserKey:'oxnard-public-project-bids-v1',parserVersion:'1.0.0',signals,structureMatched,
  skippedRows,duplicateExternalIds:0,stableExternalIdCount:signals.length}
}
