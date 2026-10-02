import type { PublicOpportunitySignal, UsStateOrDcCode } from '@jhadina/opportunity-core'

export type GenericPublicSourceDescriptor={
  sourceId:string
  sourceName:string
  sourceUrl:string
  state:UsStateOrDcCode
  county?:string
  locality?:string
  buyer?:string
  sourceKinds?:string[]
}

export type GenericAdapterParseResult={
  parserKey:'generic-html-table-v1'|'generic-rss-atom-v1'|'generic-json-collection-v1'
  parserVersion:'1.1.0'
  signals:PublicOpportunitySignal[]
  skippedRows:number
  duplicateExternalIds:number
  stableExternalIdCount:number
}

const htmlAliases={
  title:['title','project','project title','description','services','service','bid description','solicitation title','name','contract','contract title'],
  id:['solicitation number','solicitation no','bid number','bid no','event number','rfp number','rfq number','reference number','reference','number','contract number'],
  deadline:['close date','closing date','due date','response deadline','bid due date','proposal due date','deadline','closing'],
  awardedPrime:['awarded vendor','awardee','vendor','supplier','contractor','successful bidder','awarded to'],
  amount:['award amount','contract amount','amount','value','bid amount'],
}

const clean=(value:string)=>value.replace(/\s+/g,' ').trim()
const decode=(value:string)=>value
  .replace(/&nbsp;|&#160;/gi,' ')
  .replace(/&amp;/gi,'&')
  .replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'")
  .replace(/&lt;/gi,'<')
  .replace(/&gt;/gi,'>')

const stripHtml=(value:string)=>clean(decode(value.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')))
const norm=(value:string)=>stripHtml(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()

function href(value:string,base:string):string|undefined{
  const match=value.match(/href\s*=\s*["']([^"']+)["']/i)
  if(!match?.[1])return undefined
  try{return new URL(decode(match[1]),base).toString()}catch{return undefined}
}

function date(value:string):string|undefined{
  const raw=clean(value)
  if(!raw||/continuous|open until filled|ongoing/i.test(raw))return undefined
  const iso=raw.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  if(iso)return `${iso[1]}-${String(Number(iso[2])).padStart(2,'0')}-${String(Number(iso[3])).padStart(2,'0')}`
  const us=raw.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/)
  if(us){
    const year=Number(us[3])<100?2000+Number(us[3]):Number(us[3])
    return `${year}-${String(Number(us[1])).padStart(2,'0')}-${String(Number(us[2])).padStart(2,'0')}`
  }
  const monthNames:Record<string,number>={
    january:1,february:2,march:3,april:4,may:5,june:6,
    july:7,august:8,september:9,october:10,november:11,december:12,
  }
  const month=raw.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i)
  if(month){
    const monthNumber=monthNames[month[1]!.toLowerCase()]!
    return `${month[3]}-${String(monthNumber).padStart(2,'0')}-${String(Number(month[2])).padStart(2,'0')}`
  }
  return undefined
}

function deadlineFromText(value:string):string|undefined{
  const raw=clean(value)
  const labels=[
    'bids due','bid due','proposals due','proposal due','quotes due','quote due',
    'responses due','response deadline','closing date','close date','closes','deadline','accepted until',
  ]
  const lowered=raw.toLowerCase()
  for(const label of labels){
    const index=lowered.indexOf(label)
    if(index<0)continue
    const parsed=date(raw.slice(index,index+260))
    if(parsed)return parsed
  }
  return undefined
}

function money(value:string):{max:number;currency:string}|undefined{
  const match=stripHtml(value).match(/\$?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/)
  if(!match?.[1])return undefined
  const amount=Number(match[1].replace(/,/g,''))
  return Number.isFinite(amount)&&amount>0?{max:amount,currency:'USD'}:undefined
}

function opportunityStage(source:GenericPublicSourceDescriptor):'award'|'open_solicitation'{
  return source.sourceKinds?.includes('award')?'award':'open_solicitation'
}

const GENERIC_NAVIGATION_TITLES=new Set([
  'bids','bid postings','bids and rfps','bids rfps','rfps','current bids','open bids',
  'contract opportunities','open contract opportunities','view open contract opportunities',
  'procurement','purchasing','solicitations','current solicitations','bid opportunities',
  'read on','details','view details','learn more','sign up',
])

function genericNavigationTitle(value:string):boolean{
  return GENERIC_NAVIGATION_TITLES.has(norm(value))
}

function strongProcurementTitle(value:string):boolean{
  const title=stripHtml(value)
  return /\b(?:RFP|RFQ|IFB|ITB)\b/i.test(title)||
    /\brequest\s+for\s+(?:proposals?|quotes?|qualifications?|bids?)\b/i.test(title)||
    /\binvitation\s+to\s+bid\b/i.test(title)||
    /\bsolicitation\s*(?:#|no\.?|number)\b/i.test(title)||
    /\bbid\s*(?:#|no\.?|number)\s*[A-Z0-9-]+/i.test(title)
}

function opportunityDetailUrl(raw:string):boolean{
  try{
    const url=new URL(raw)
    const keys=[...url.searchParams.keys()].map(key=>key.toLowerCase())
    if(keys.some(key=>['bidid','bid_id','rfpid','rfp_id','rfqid','rfq_id','solicitationid','eventid','event_id','bidnumber'].includes(key)))return true
    const parts=url.pathname.toLowerCase().split('/').filter(Boolean)
    const genericNext=new Set(['category','open','closed','current','archive','archives','signup','search'])
    for(let index=0;index<parts.length-1;index+=1){
      if(!['bid','bids','rfp','rfps','rfq','rfqs','solicitation','solicitations','opportunity','opportunities'].includes(parts[index]!))continue
      const next=parts[index+1]!
      if(next&&!genericNext.has(next))return true
    }
    return false
  }catch{return false}
}

function headerIndex(headers:string[],aliases:string[]):number{
  const normalized=headers.map(norm)
  for(const alias of aliases){
    const exact=normalized.indexOf(alias)
    if(exact>=0)return exact
  }
  for(let i=0;i<normalized.length;i++){
    if(aliases.some(alias=>normalized[i]?.includes(alias)))return i
  }
  return -1
}

function evidence(sourceId:string,externalId:string,capturedAt:string){
  return `${sourceId}:${encodeURIComponent(externalId).slice(0,120)}:${capturedAt}`
}

function finalize(parserKey:GenericAdapterParseResult['parserKey'],signals:PublicOpportunitySignal[],skippedRows:number):GenericAdapterParseResult{
  const ids=signals.map(s=>s.externalId).filter((x):x is string=>Boolean(x))
  const duplicateExternalIds=ids.length-new Set(ids).size
  return {parserKey,parserVersion:'1.1.0',signals,skippedRows,duplicateExternalIds,stableExternalIdCount:ids.length}
}

export function parseGenericHtmlOpportunityTable(
  html:string,
  source:GenericPublicSourceDescriptor,
  capturedAt=new Date().toISOString(),
):GenericAdapterParseResult{
  const signals:PublicOpportunitySignal[]=[]
  const seen=new Set<string>()
  let skippedRows=0
  const stage=opportunityStage(source)
  const addSignal=(signal:PublicOpportunitySignal)=>{
    const identity=signal.externalId??signal.sourceUrl
    if(seen.has(identity))return
    seen.add(identity)
    signals.push(signal)
  }

  for(const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
    const rows=[...(table[1]??'').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    if(rows.length<2)continue
    const headerCells=[...(rows[0]?.[1]??'').matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(m=>m[1]??'')
    const titleIndex=headerIndex(headerCells,htmlAliases.title)
    const idIndex=headerIndex(headerCells,htmlAliases.id)
    const deadlineIndex=headerIndex(headerCells,htmlAliases.deadline)
    const primeIndex=headerIndex(headerCells,htmlAliases.awardedPrime)
    const amountIndex=headerIndex(headerCells,htmlAliases.amount)
    if(titleIndex<0)continue
    if(stage==='award'&&primeIndex<0)continue

    for(const row of rows.slice(1)){
      const cells=[...(row[1]??'').matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(m=>m[1]??'')
      const title=stripHtml(cells[titleIndex]??'')
      const idText=idIndex>=0?stripHtml(cells[idIndex]??''):''
      const detailUrl=(idIndex>=0?href(cells[idIndex]??'',source.sourceUrl):undefined)
        ||href(cells[titleIndex]??'',source.sourceUrl)
        ||source.sourceUrl
      const externalId=idText||(detailUrl!==source.sourceUrl?detailUrl:undefined)
      const awardedPrimeName=primeIndex>=0?stripHtml(cells[primeIndex]??''):undefined
      if(!title||!externalId||(stage==='award'&&!awardedPrimeName)){skippedRows+=1;continue}
      addSignal({
        id:`local:${source.state.toLowerCase()}:${encodeURIComponent(source.sourceId)}:${encodeURIComponent(externalId).slice(0,140)}`,
        sourceId:source.sourceId,
        sourceUrl:detailUrl,
        sourceName:source.sourceName,
        title,
        description:`Public procurement ${stage==='award'?'award':'opportunity'} discovered from ${source.sourceName}.`,
        stage,
        state:source.state,
        county:source.county,
        locality:source.locality,
        externalId,
        amount:amountIndex>=0?money(cells[amountIndex]??''):undefined,
        deadline:stage==='open_solicitation'&&deadlineIndex>=0?date(stripHtml(cells[deadlineIndex]??'')):undefined,
        buyer:source.buyer,
        awardedPrimeName:stage==='award'?awardedPrimeName:undefined,
        capturedAt,
        evidenceRef:evidence(source.sourceId,externalId,capturedAt),
      })
    }
  }

  if(stage==='open_solicitation'){
    for(const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
      const title=stripHtml(match[2]??'')
      if(!title||genericNavigationTitle(title))continue
      const detailUrl=href(match[0],source.sourceUrl)
      if(!detailUrl||detailUrl===source.sourceUrl)continue
      if(!strongProcurementTitle(title)&&!opportunityDetailUrl(detailUrl))continue
      const index=match.index??0
      const context=stripHtml(html.slice(Math.max(0,index-180),Math.min(html.length,index+match[0].length+700)))
      const externalId=detailUrl
      addSignal({
        id:`local:${source.state.toLowerCase()}:${encodeURIComponent(source.sourceId)}:${encodeURIComponent(externalId).slice(0,140)}`,
        sourceId:source.sourceId,
        sourceUrl:detailUrl,
        sourceName:source.sourceName,
        title,
        description:`Public procurement opportunity discovered from ${source.sourceName}.`,
        stage:'open_solicitation',
        state:source.state,
        county:source.county,
        locality:source.locality,
        externalId,
        deadline:deadlineFromText(context),
        buyer:source.buyer,
        capturedAt,
        evidenceRef:evidence(source.sourceId,externalId,capturedAt),
      })
    }

    if(signals.length===0){
      const title=stripHtml(source.sourceName)
      const body=stripHtml(html).slice(0,500_000)
      const titleNorm=norm(title)
      const bodyNorm=norm(body)
      const titleEchoed=titleNorm.length>=6&&bodyNorm.includes(titleNorm)
      if(
        titleEchoed&&
        !genericNavigationTitle(title)&&
        (strongProcurementTitle(title)||opportunityDetailUrl(source.sourceUrl))
      ){
        const externalId=source.sourceUrl
        addSignal({
          id:`local:${source.state.toLowerCase()}:${encodeURIComponent(source.sourceId)}:${encodeURIComponent(externalId).slice(0,140)}`,
          sourceId:source.sourceId,
          sourceUrl:source.sourceUrl,
          sourceName:source.sourceName,
          title,
          description:`Public procurement opportunity discovered from ${source.sourceName}.`,
          stage:'open_solicitation',
          state:source.state,
          county:source.county,
          locality:source.locality,
          externalId,
          deadline:deadlineFromText(body),
          buyer:source.buyer,
          capturedAt,
          evidenceRef:evidence(source.sourceId,externalId,capturedAt),
        })
      }
    }
  }

  return finalize('generic-html-table-v1',signals,skippedRows)
}

function xmlTag(block:string,names:string[]):string|undefined{
  for(const name of names){
    const match=block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'))
    if(match?.[1])return stripHtml(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1'))
  }
  return undefined
}

function xmlLink(block:string):string|undefined{
  const hrefMatch=block.match(/<link\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*\/?\s*>/i)
  if(hrefMatch?.[1])return decode(hrefMatch[1])
  return xmlTag(block,['link'])
}

export function parseGenericRssAtomFeed(
  xml:string,
  source:GenericPublicSourceDescriptor,
  capturedAt=new Date().toISOString(),
):GenericAdapterParseResult{
  const signals:PublicOpportunitySignal[]=[]
  let skippedRows=0
  const blocks=[
    ...[...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(m=>m[1]??''),
    ...[...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(m=>m[1]??''),
  ]
  for(const block of blocks){
    const title=xmlTag(block,['title'])??''
    const linkRaw=xmlLink(block)
    const id=xmlTag(block,['guid','id'])||linkRaw
    if(!title||!id){skippedRows+=1;continue}
    let sourceUrl=source.sourceUrl
    if(linkRaw){try{sourceUrl=new URL(linkRaw,source.sourceUrl).toString()}catch{}}
    const summary=xmlTag(block,['description','summary','content'])
    signals.push({
      id:`local:${source.state.toLowerCase()}:${encodeURIComponent(source.sourceId)}:${encodeURIComponent(id).slice(0,140)}`,
      sourceId:source.sourceId,
      sourceUrl,
      sourceName:source.sourceName,
      title,
      description:summary,
      stage:'open_solicitation',
      state:source.state,
      county:source.county,
      locality:source.locality,
      externalId:id,
      buyer:source.buyer,
      capturedAt,
      evidenceRef:evidence(source.sourceId,id,capturedAt),
    })
  }
  return finalize('generic-rss-atom-v1',signals,skippedRows)
}

function obj(value:unknown):Record<string,unknown>|undefined{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined
}
function stringValue(value:unknown):string|undefined{
  if(typeof value==='string'&&value.trim())return value.trim()
  if(typeof value==='number'&&Number.isFinite(value))return String(value)
  return undefined
}
function firstField(row:Record<string,unknown>,fields:string[]):string|undefined{
  for(const field of fields){
    const value=stringValue(row[field])
    if(value)return value
  }
  return undefined
}

export function parseGenericJsonOpportunityCollection(
  payload:unknown,
  source:GenericPublicSourceDescriptor,
  capturedAt=new Date().toISOString(),
):GenericAdapterParseResult{
  const root=obj(payload)
  const rows=Array.isArray(payload)?payload:
    (root&&(['results','items','data','opportunities','bids','solicitations'].map(k=>root[k]).find(Array.isArray) as unknown[]|undefined))??[]
  const signals:PublicOpportunitySignal[]=[]
  let skippedRows=0
  for(const value of rows){
    const row=obj(value)
    if(!row){skippedRows+=1;continue}
    const title=firstField(row,['title','name','description','projectName','solicitationTitle'])
    const id=firstField(row,['id','solicitationNumber','bidNumber','eventNumber','referenceNumber','number'])
    if(!title||!id){skippedRows+=1;continue}
    const rawUrl=firstField(row,['url','link','detailUrl','publicUrl'])
    let sourceUrl=source.sourceUrl
    if(rawUrl){try{sourceUrl=new URL(rawUrl,source.sourceUrl).toString()}catch{}}
    signals.push({
      id:`local:${source.state.toLowerCase()}:${encodeURIComponent(source.sourceId)}:${encodeURIComponent(id).slice(0,140)}`,
      sourceId:source.sourceId,
      sourceUrl,
      sourceName:source.sourceName,
      title,
      description:firstField(row,['description','summary','details']),
      stage:'open_solicitation',
      state:source.state,
      county:source.county,
      locality:source.locality,
      externalId:id,
      deadline:date(firstField(row,['deadline','dueDate','closeDate','closingDate'])??''),
      buyer:source.buyer,
      capturedAt,
      evidenceRef:evidence(source.sourceId,id,capturedAt),
    })
  }
  return finalize('generic-json-collection-v1',signals,skippedRows)
}
