import { createHash } from 'node:crypto'

export type SamWideChange='new'|'unchanged'|'amended'
export type SamWideNotice={
  noticeId:string
  solicitationNumber?:string
  title:string
  noticeType?:string
  postedDate?:string
  responseDeadline?:string
  naicsCodes:string[]
  classificationCodes:string[]
  setAside?:string
  agency?:string
  office?:string
  placeOfPerformance?:unknown
  description?:string
  sourceUrl:string
  resourceLinks:string[]
  capturedAt:string
  checksum:string
  raw:Record<string,unknown>
}

function canonical(value:unknown):unknown{
  if(Array.isArray(value))return value.map(canonical)
  if(value&&typeof value==='object'){
    const out:Record<string,unknown>={}
    for(const key of Object.keys(value as Record<string,unknown>).sort())out[key]=canonical((value as Record<string,unknown>)[key])
    return out
  }
  return value
}
export function checksumSamNotice(value:unknown):string{
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}
const text=(v:unknown)=>typeof v==='string'?v.trim():''
const first=(...v:unknown[])=>v.map(text).find(Boolean)??''
const strings=(v:unknown):string[]=>{
  const rows=Array.isArray(v)?v:[v]
  return [...new Set(rows.flatMap(row=>{
    if(typeof row==='string')return [row.trim()]
    if(row&&typeof row==='object'){
      const o=row as Record<string,unknown>
      return [text(o.url),text(o.href),text(o.link),text(o.resourceUrl)]
    }
    return []
  }).filter(Boolean))]
}
export function collectSamResourceLinks(raw:Record<string,unknown>):string[]{
  return [...new Set([...strings(raw.resourceLinks),...strings(raw.links),...strings(raw.additionalInfoLink)])]
}
export function normalizeSamWideNotice(raw:Record<string,unknown>,capturedAt=new Date().toISOString()):SamWideNotice{
  const noticeId=first(raw.noticeId,raw.solicitationNumber,raw.contractOpportunityId)
  if(!noticeId)throw new Error('SAM notice is missing noticeId')
  const naics=[...new Set([...strings(raw.naicsCode),...strings(raw.naicsCodes)])]
  const classificationCodes=[...new Set([...strings(raw.classificationCode),...strings(raw.classificationCodes)])]
  return {
    noticeId,
    solicitationNumber:first(raw.solicitationNumber)||undefined,
    title:first(raw.title,raw.subject,'SAM.gov opportunity'),
    noticeType:first(raw.type,raw.noticeType,raw.baseType)||undefined,
    postedDate:first(raw.postedDate,raw.publishDate)||undefined,
    responseDeadline:first(raw.responseDeadLine,raw.responseDeadline,raw.archiveDate)||undefined,
    naicsCodes:naics,
    classificationCodes,
    setAside:first(raw.typeOfSetAsideDescription,raw.typeOfSetAside,raw.setAside)||undefined,
    agency:first(raw.fullParentPathName,raw.department,raw.organizationName)||undefined,
    office:first(raw.office,raw.subTier)||undefined,
    placeOfPerformance:raw.placeOfPerformance,
    description:first(raw.description,raw.title)||undefined,
    sourceUrl:first(raw.uiLink,raw.url,raw.link)||`https://sam.gov/opp/${noticeId}/view`,
    resourceLinks:collectSamResourceLinks(raw),
    capturedAt,
    checksum:checksumSamNotice(raw),
    raw,
  }
}
export function classifySamNoticeChange(previousChecksum:string|undefined,currentChecksum:string):SamWideChange{
  return !previousChecksum?'new':previousChecksum===currentChecksum?'unchanged':'amended'
}
function parseIsoDate(value:string):Date{
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if(!m)throw new Error('Date must use YYYY-MM-DD')
  return new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])))
}
const fmt=(d:Date)=>`${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')}/${d.getUTCFullYear()}`
export function buildSamDateWindows(input:{from:string;to:string;windowDays?:number}):Array<{postedFrom:string;postedTo:string}>{
  const start=parseIsoDate(input.from),end=parseIsoDate(input.to)
  if(end<start)throw new Error('SAM scan end must be on or after start')
  const span=Math.max(1,Math.min(input.windowDays??7,31))
  const out:Array<{postedFrom:string;postedTo:string}>=[]
  for(let cursor=new Date(start);cursor<=end;){
    const windowEnd=new Date(Math.min(end.getTime(),cursor.getTime()+(span-1)*86400000))
    out.push({postedFrom:fmt(cursor),postedTo:fmt(windowEnd)})
    cursor=new Date(windowEnd.getTime()+86400000)
  }
  return out
}
