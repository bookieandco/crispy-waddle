import type { PublicOpportunitySignal, PublicProcurementSourceKind, UsStateOrDcCode } from '@jhadina/opportunity-core'

export type GenericPublicSourceDescriptor={
  sourceId:string
  sourceName:string
  sourceUrl:string
  state:UsStateOrDcCode
  county?:string
  locality?:string
  buyer?:string
  sourceKinds?:PublicProcurementSourceKind[]
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
  title:['title','project','project title','description','services','service','bid description','solicitation title','name'],
  id:['solicitation number','solicitation no','bid number','bid no','event number','rfp number','rfq number','reference number','reference','number'],
  deadline:['close date','closing date','due date','response deadline','bid due date','proposal due date','deadline'],
  awardPrime:['awarded vendor','awardee','awarded to','successful bidder','winning bidder','prime contractor','vendor','contractor','supplier'],
  awardAmount:['award amount','awarded amount','contract amount','award value','total award','amount'],
  awardDate:['award date','date awarded','awarded date','contract award date'],
  naics:['naics','naics code'],
  psc:['psc','psc code','product service code'],
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
  const iso=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if(iso)return `${iso[1]}-${String(Number(iso[2])).padStart(2,'0')}-${String(Number(iso[3])).padStart(2,'0')}`
  const us=raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if(us){
    const year=Number(us[3])<100?2000+Number(us[3]):Number(us[3])
    return `${year}-${String(Number(us[1])).padStart(2,'0')}-${String(Number(us[2])).padStart(2,'0')}`
  }
  return undefined
}


function amount(value:string):number|undefined{
  const raw=clean(value)
  if(!raw)return undefined
  const negative=/^\(.*\)$/.test(raw)
  const normalized=raw.replace(/[^0-9.-]/g,'')
  if(!normalized)return undefined
  const parsed=Number(normalized)
  if(!Number.isFinite(parsed))return undefined
  return negative?-Math.abs(parsed):parsed
}

function awardCapable(source:GenericPublicSourceDescriptor):boolean{
  return source.sourceKinds?.includes('award')??false
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
  let skippedRows=0
  for(const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
    const rows=[...(table[1]??'').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    if(rows.length<2)continue
    const headerCells=[...(rows[0]?.[1]??'').matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(m=>m[1]??'')
    const titleIndex=headerIndex(headerCells,htmlAliases.title)
    const idIndex=headerIndex(headerCells,htmlAliases.id)
    const deadlineIndex=headerIndex(headerCells,htmlAliases.deadline)
    const awardPrimeIndex=headerIndex(headerCells,htmlAliases.awardPrime)
    const awardAmountIndex=headerIndex(headerCells,htmlAliases.awardAmount)
    const awardDateIndex=headerIndex(headerCells,htmlAliases.awardDate)
    const naicsIndex=headerIndex(headerCells,htmlAliases.naics)
    const pscIndex=headerIndex(headerCells,htmlAliases.psc)
    if(titleIndex<0||idIndex<0)continue

    for(const row of rows.slice(1)){
      const cells=[...(row[1]??'').matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(m=>m[1]??'')
      const title=stripHtml(cells[titleIndex]??'')
      const idText=stripHtml(cells[idIndex]??'')
      const detailUrl=href(cells[idIndex]??'',source.sourceUrl)||href(cells[titleIndex]??'',source.sourceUrl)||source.sourceUrl
      const externalId=idText||(detailUrl!==source.sourceUrl?detailUrl:undefined)
      if(!title||!externalId){skippedRows+=1;continue}
      const awardedPrimeName=awardPrimeIndex>=0?stripHtml(cells[awardPrimeIndex]??''):undefined
      const isAward=awardCapable(source)&&Boolean(awardedPrimeName)
      const awardAmount=awardAmountIndex>=0?amount(stripHtml(cells[awardAmountIndex]??'')):undefined
      signals.push({
        id:`local:${source.state.toLowerCase()}:${encodeURIComponent(source.sourceId)}:${encodeURIComponent(externalId).slice(0,140)}`,
        sourceId:source.sourceId,
        sourceUrl:detailUrl,
        sourceName:source.sourceName,
        title,
        description:isAward?`Public procurement award discovered from ${source.sourceName}.`:`Public procurement opportunity discovered from ${source.sourceName}.`,
        stage:isAward?'award':'open_solicitation',
        state:source.state,
        county:source.county,
        locality:source.locality,
        externalId,
        deadline:!isAward&&deadlineIndex>=0?date(stripHtml(cells[deadlineIndex]??'')):undefined,
        buyer:source.buyer,
        awardedPrimeName:isAward?awardedPrimeName:undefined,
        awardDate:isAward&&awardDateIndex>=0?date(stripHtml(cells[awardDateIndex]??'')):undefined,
        amount:isAward&&awardAmount!==undefined?{max:awardAmount,currency:'USD'}:undefined,
        naicsCode:naicsIndex>=0?stripHtml(cells[naicsIndex]??'')||undefined:undefined,
        pscCode:pscIndex>=0?stripHtml(cells[pscIndex]??'')||undefined:undefined,
        capturedAt,
        evidenceRef:evidence(source.sourceId,externalId,capturedAt),
      })
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
    const awardedPrimeName=xmlTag(block,['awardee','awardedTo','vendor','contractor'])
    const isAward=awardCapable(source)&&Boolean(awardedPrimeName)
    const awardAmount=amount(xmlTag(block,['awardAmount','contractAmount'])??'')
    signals.push({
      id:`local:${source.state.toLowerCase()}:${encodeURIComponent(source.sourceId)}:${encodeURIComponent(id).slice(0,140)}`,
      sourceId:source.sourceId,
      sourceUrl,
      sourceName:source.sourceName,
      title,
      description:summary,
      stage:isAward?'award':'open_solicitation',
      state:source.state,
      county:source.county,
      locality:source.locality,
      externalId:id,
      buyer:source.buyer,
      awardedPrimeName:isAward?awardedPrimeName:undefined,
      awardDate:isAward?date(xmlTag(block,['awardDate','dateAwarded'])??''):undefined,
      amount:isAward&&awardAmount!==undefined?{max:awardAmount,currency:'USD'}:undefined,
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
    const awardedPrimeName=firstField(row,['awardedPrimeName','awardeeName','awardedVendor','vendorName','contractorName','supplierName','awardee'])
    const isAward=awardCapable(source)&&Boolean(awardedPrimeName)
    const rawAmount=firstField(row,['awardAmount','awardedAmount','contractAmount','awardValue','amount'])
    const awardAmount=rawAmount?amount(rawAmount):undefined
    signals.push({
      id:`local:${source.state.toLowerCase()}:${encodeURIComponent(source.sourceId)}:${encodeURIComponent(id).slice(0,140)}`,
      sourceId:source.sourceId,
      sourceUrl,
      sourceName:source.sourceName,
      title,
      description:firstField(row,['description','summary','details']),
      stage:isAward?'award':'open_solicitation',
      state:source.state,
      county:source.county,
      locality:source.locality,
      externalId:id,
      deadline:!isAward?date(firstField(row,['deadline','dueDate','closeDate','closingDate'])??''):undefined,
      buyer:source.buyer,
      awardedPrimeName:isAward?awardedPrimeName:undefined,
      awardDate:isAward?date(firstField(row,['awardDate','dateAwarded','awardedDate','contractAwardDate'])??''):undefined,
      amount:isAward&&awardAmount!==undefined?{max:awardAmount,currency:firstField(row,['currency','currencyCode'])??'USD'}:undefined,
      naicsCode:firstField(row,['naicsCode','naics']),
      pscCode:firstField(row,['pscCode','psc','productServiceCode']),
      capturedAt,
      evidenceRef:evidence(source.sourceId,id,capturedAt),
    })
  }
  return finalize('generic-json-collection-v1',signals,skippedRows)
}
