import type { SupabaseClient } from '@supabase/supabase-js'
import { evaluateSamSubcontractability, extractSolicitationIntelligence, type SamContractKind, type SolicitationDocument } from '@jhadina/opportunity-core'

const rows=(x:unknown):Record<string,unknown>[]=>Array.isArray(x)?x.filter((v):v is Record<string,unknown>=>Boolean(v&&typeof v==='object')):[]
const allText=(docs:Record<string,unknown>[])=>docs.map(d=>typeof d.extracted_text==='string'?d.extracted_text:'').filter(Boolean).join('\n')
const agencyKind=(agency:string)=>/department of defense|\bdod\b|army|navy|air force|marine corps|defense logistics/i.test(agency)?'dod' as const:agency?'civilian' as const:'unknown' as const
function contractKind(text:string,isFood:boolean):SamContractKind{
  if(/specialty construction|electrical|plumbing|hvac|roofing/i.test(text))return'specialty_construction'
  if(/construction|renovation|building modification/i.test(text))return'general_construction'
  if(isFood||/supply|supplies|commodity|deliver(y|ies)|product|equipment/i.test(text))return'supply'
  if(/service|support|staffing|maintenance|consulting/i.test(text))return'service'
  return'unknown'
}
function detectedClauses(text:string,extracted:string[]){
  const out=[...extracted]
  for(const [re,label] of [
    [/52\.219-14|limitations? on subcontracting/i,'FAR 52.219-14 / limitations on subcontracting'],
    [/52\.219-33|nonmanufacturer/i,'FAR 52.219-33 / nonmanufacturer rule'],
    [/252\.225-7012|berry amendment/i,'DFARS 252.225-7012 / Berry Amendment'],
    [/52\.225-5|trade agreements/i,'FAR 52.225-5 / Trade Agreements'],
    [/52\.225-1|buy american/i,'FAR 52.225-1 / Buy American'],
  ] as const)if(re.test(text))out.push(label)
  return [...new Set(out)]
}

export async function analyzeSamNotices(client:SupabaseClient,noticeIds:string[]){
  let analyzed=0
  for(const noticeId of noticeIds){
    const {data:catalog,error:catalogError}=await client.from('jhadina_sam_catalog').select('*').eq('notice_id',noticeId).maybeSingle()
    if(catalogError||!catalog)continue
    const {data:documentRows}=await client.from('jhadina_sam_documents').select('*').eq('notice_id',noticeId)
    const docs=rows(documentRows)
    const solicitationDocs:SolicitationDocument[]=[]
    const rawDescription=typeof (catalog as Record<string,unknown>).description==='string'?String((catalog as Record<string,unknown>).description):''
    const fetchedNotice=docs.find(d=>d.source_kind==='notice'&&typeof d.extracted_text==='string'&&String(d.extracted_text).trim().length>0)
    const fetchedNoticeText=fetchedNotice?String(fetchedNotice.extracted_text):''
    const description=/^https?:\/\//i.test(rawDescription)?fetchedNoticeText:rawDescription
    if(description)solicitationDocs.push({
      id:`${noticeId}:notice`,
      opportunityId:noticeId,
      kind:'notice',
      version:String((catalog as Record<string,unknown>).version??1),
      capturedAt:String(fetchedNotice?.fetched_at??new Date().toISOString()),
      sourceRef:String(fetchedNotice?.source_url??(catalog as Record<string,unknown>).source_url),
      text:description,
    })
    for(const d of docs){
      const text=typeof d.extracted_text==='string'?d.extracted_text:''
      if(!text||d.source_kind==='notice')continue
      solicitationDocs.push({id:`${noticeId}:doc:${d.id}`,opportunityId:noticeId,kind:'attachment',version:String((catalog as Record<string,unknown>).version??1),capturedAt:String(d.fetched_at??new Date().toISOString()),sourceRef:String(d.source_url),text})
    }
    if(!solicitationDocs.length)continue
    const extraction=extractSolicitationIntelligence(solicitationDocs)
    const text=`${description}\n${docs.filter(d=>d.source_kind!=='notice').map(d=>typeof d.extracted_text==='string'?d.extracted_text:'').filter(Boolean).join('\n')}`
    const food=/\b(food|meal|grocery|groceries|meat|dairy|produce|beverage|catering|ration)\b/i.test(text)
    const clauses=detectedClauses(text,extraction.clauses)
    const decision=evaluateSamSubcontractability({
      agencyKind:agencyKind(String((catalog as Record<string,unknown>).agency??'')),
      contractKind:contractKind(text,food),
      isFood:food,
      setAside:typeof (catalog as Record<string,unknown>).set_aside==='string'?String((catalog as Record<string,unknown>).set_aside):undefined,
      clauses,
    })
    const naics=Array.isArray((catalog as Record<string,unknown>).naics_codes)?((catalog as Record<string,unknown>).naics_codes as string[]):[]
    const requirements=extraction.requirements.map(r=>({...r,naicsCodes:naics,keywords:r.label.toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>3).slice(0,12)}))
    const {error}=await client.from('jhadina_sam_analysis').upsert({notice_id:noticeId,requirements,solicitation:{...extraction,clauses},subcontractability:decision,analyzed_at:new Date().toISOString()},{onConflict:'notice_id'})
    if(!error)analyzed+=1
  }
  return {analyzed}
}
