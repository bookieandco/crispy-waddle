import {
  normalizePublicOpportunitySignal,
  runPublicSourceScan,
  type Opportunity,
  type PublicOpportunitySignal,
  type PublicProcurementSource,
  type PublicSourceAdapter,
  type PublicSourceCheckpoint,
  type PublicSourceHealth,
  type PublicSourceScanResult,
} from '@jhadina/opportunity-core'

export const LA_COUNTY_MASTER_AGREEMENT_SOURCE_ID='ca.los-angeles-county.isd-master-agreements'
export const LA_COUNTY_MASTER_AGREEMENT_URL='https://doingbusiness.lacounty.gov/contract-opportunities/'

const collapse=(value:string)=>value.replace(/\s+/g,' ').trim()

function decodeHtml(value:string):string{
  return value
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
}

function textFromHtml(value:string):string{
  return collapse(decodeHtml(value.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')))
}

function firstHref(value:string):string|undefined{
  const match=value.match(/href\s*=\s*["']([^"']+)["']/i)
  if(!match?.[1])return undefined
  try{return new URL(decodeHtml(match[1]),LA_COUNTY_MASTER_AGREEMENT_URL).toString()}catch{return undefined}
}

function safeId(value:string):string{
  return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100)
}

function parseUsDate(value:string):string|undefined{
  const match=value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if(!match)return undefined
  const [,month,day,year]=match
  return `${year}-${String(Number(month)).padStart(2,'0')}-${String(Number(day)).padStart(2,'0')}`
}

export function parseLosAngelesCountyMasterAgreementHtml(
  html:string,
  capturedAt=new Date().toISOString(),
):PublicOpportunitySignal[]{
  if(!/Solicitation Number/i.test(html)||!/Master Agreement/i.test(html)){
    throw new Error('la_county_master_agreement_contract_changed')
  }
  const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
  const signals:PublicOpportunitySignal[]=[]
  for(const row of rows){
    const cells=[...row[1]!.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(match=>match[1]??'')
    if(cells.length<4)continue
    const service=textFromHtml(cells[0]!)
    const solicitation=textFromHtml(cells[1]!)
    const openDate=textFromHtml(cells[2]!)
    const closeDate=textFromHtml(cells[3]!)
    if(!service||!solicitation||/Solicitation Number/i.test(solicitation))continue
    const detailUrl=firstHref(cells[1]!)??LA_COUNTY_MASTER_AGREEMENT_URL
    const evidenceRef=`${LA_COUNTY_MASTER_AGREEMENT_SOURCE_ID}:${safeId(solicitation)}:${capturedAt}`
    signals.push({
      id:`local:ca:los-angeles-county:master-agreement:${safeId(solicitation)}`,
      sourceId:LA_COUNTY_MASTER_AGREEMENT_SOURCE_ID,
      sourceUrl:detailUrl,
      sourceName:'Los Angeles County ISD Open Master Agreements',
      title:service,
      description:`Los Angeles County open Master Agreement. Solicitation ${solicitation}; opened ${openDate||'date unavailable'}; closes ${closeDate||'date unavailable'}.`,
      stage:'open_solicitation',
      state:'CA',
      county:'Los Angeles',
      externalId:solicitation,
      deadline:/continuous/i.test(closeDate)?undefined:parseUsDate(closeDate),
      buyer:'Los Angeles County Internal Services Department',
      procurementVehicle:'master_agreement',
      capturedAt,
      evidenceRef,
    })
  }
  if(signals.length===0)throw new Error('la_county_master_agreement_no_rows')
  return signals
}

export function createLosAngelesCountyMasterAgreementAdapter(
  fetchImpl:typeof fetch=fetch,
):PublicSourceAdapter{
  return {
    sourceId:LA_COUNTY_MASTER_AGREEMENT_SOURCE_ID,
    async fetch({source,now}){
      const url=source.officialUrl??LA_COUNTY_MASTER_AGREEMENT_URL
      const response=await fetchImpl(url,{
        headers:{accept:'text/html','user-agent':'Jhadina-Public-Opportunity-Discovery/1.0'},
        cache:'no-store',
        signal:AbortSignal.timeout(30_000),
      })
      if(!response.ok)throw new Error(`la_county_master_agreement_http_${response.status}`)
      const html=await response.text()
      const signals=parseLosAngelesCountyMasterAgreementHtml(html,now)
      const lastExternalId=signals.map(signal=>signal.externalId??'').filter(Boolean).sort().at(-1)
      return {
        sourceId:source.id,
        signals,
        checkpoint:{sourceId:source.id,lastExternalId,lastObservedAt:now},
        fetchedAt:now,
        evidenceRefs:signals.map(signal=>signal.evidenceRef),
      }
    },
  }
}

export type LosAngelesCountyReferenceScan = PublicSourceScanResult & {
  opportunities:Opportunity[]
}

export async function scanLosAngelesCountyMasterAgreements(input:{
  source:PublicProcurementSource
  checkpoint?:PublicSourceCheckpoint
  previousHealth?:PublicSourceHealth
  fetchImpl?:typeof fetch
  now?:string
}):Promise<LosAngelesCountyReferenceScan>{
  const result=await runPublicSourceScan({
    source:input.source,
    adapter:createLosAngelesCountyMasterAgreementAdapter(input.fetchImpl),
    checkpoint:input.checkpoint,
    previousHealth:input.previousHealth,
    now:input.now,
  })
  return {...result,opportunities:result.signals.map(normalizePublicOpportunitySignal)}
}
