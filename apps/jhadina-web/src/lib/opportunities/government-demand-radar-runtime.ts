import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  analyzeSolicitationQa,
  buildGovernmentDemandProfiles,
  buildRecompeteWatches,
  type GovernmentDemandObservation,
  type GovernmentDemandObservationStage,
  type SolicitationQuestion,
} from '@jhadina/opportunity-core'

type SamCatalogRow={
  notice_id:string
  title:string
  notice_type:string
  posted_date:string|null
  naics_codes:string[]
  classification_codes:string[]
  set_aside:string|null
  agency:string|null
  office:string|null
  description:string|null
  source_url:string|null
  raw:unknown
  last_seen_at:string
}

type PublicAwardRow={
  id:string
  opportunity_id:string|null
  title:string
  buyer:string
  awarded_prime_name:string
  awarded_prime_ref:string|null
  award_amount:number|null
  naics_code:string|null
  psc_code:string|null
  scope_text:string|null
  award_date:string|null
  source_url:string
  captured_at:string
  evidence_refs:string[]
}

type SamAnalysisRow={
  notice_id:string
  operating:unknown
}

type SamDocumentRow={
  id:number
  notice_id:string
  source_url:string
  source_kind:string
  checksum:string
  extracted_text:string|null
  fetch_status:string
  evidence:unknown
}

const uniq=(values:string[])=>[...new Set(values.map(v=>v.trim()).filter(Boolean))]
const clean=(value:unknown)=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const asObject=(value:unknown):Record<string,unknown>|undefined=>
  value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined

function boundedInt(raw:string|undefined,fallback:number,min:number,max:number){
  const parsed=Number(raw)
  return Number.isInteger(parsed)&&parsed>=min&&parsed<=max?parsed:fallback
}

function profileId(buyer:string){
  return `government-demand:${createHash('sha256').update(buyer.toLowerCase().trim()).digest('hex').slice(0,32)}`
}

function noticeStage(row:SamCatalogRow):GovernmentDemandObservationStage|undefined{
  const type=row.notice_type.trim().toLowerCase()
  if(type==='sources sought')return'sources_sought'
  if(type==='presolicitation')return'presolicitation'
  if(type==='solicitation'||type==='combined synopsis/solicitation')return'solicitation'
  if(type==='award notice')return'award'
  if(type==='special notice'&&/amend(?:ment)?\b/i.test(`${row.title} ${row.description??''}`))return'amendment'
  return undefined
}

function keywordTokens(value:string){
  const stop=new Set([
    'this','that','with','from','will','shall','have','into','your','their','there','which',
    'notice','solicitation','contract','government','services','service','requirement','requirements',
  ])
  return uniq(value.toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/)
    .filter(token=>token.length>=4&&!stop.has(token))).slice(0,40)
}

function awardObject(raw:unknown){
  const root=asObject(raw)
  const award=asObject(root?.award)
  if(!award)return undefined
  const amountRaw=award.amount
  const amount=typeof amountRaw==='number'?amountRaw:
    typeof amountRaw==='string'&&amountRaw.trim()!==''?Number(amountRaw):undefined
  return {
    awardee:clean(award.awardee),
    number:clean(award.number),
    date:clean(award.date),
    amount:Number.isFinite(amount)?amount:undefined,
  }
}

function samObservation(row:SamCatalogRow):GovernmentDemandObservation|undefined{
  const stage=noticeStage(row)
  if(!stage)return undefined
  const buyer=clean(row.office)||clean(row.agency)
  if(!buyer)return undefined
  const award=stage==='award'?awardObject(row.raw):undefined
  return {
    id:`sam:${row.notice_id}`,
    buyer,
    buyerRef:clean(row.agency)||undefined,
    title:row.title,
    stage,
    naicsCodes:row.naics_codes??[],
    pscCodes:row.classification_codes??[],
    keywords:keywordTokens(`${row.title} ${row.description??''}`),
    setAside:row.set_aside??undefined,
    awardeeName:award?.awardee||undefined,
    awardeeRef:award?.number||undefined,
    awardAmount:award?.amount,
    postedAt:row.posted_date??undefined,
    awardDate:award?.date||undefined,
    sourceRefs:[row.source_url?.trim()||`sam-notice:${row.notice_id}`],
  }
}

function publicAwardObservation(row:PublicAwardRow):GovernmentDemandObservation{
  return {
    id:`public-award:${row.id}`,
    buyer:row.buyer,
    title:row.title,
    stage:'award',
    naicsCodes:row.naics_code?[row.naics_code]:[],
    pscCodes:row.psc_code?[row.psc_code]:[],
    keywords:keywordTokens(`${row.title} ${row.scope_text??''}`),
    awardeeName:row.awarded_prime_name,
    awardeeRef:row.awarded_prime_ref??undefined,
    awardAmount:row.award_amount??undefined,
    awardDate:row.award_date??undefined,
    sourceRefs:row.evidence_refs?.length?row.evidence_refs:[row.source_url],
  }
}

async function loadRecentSamCatalog(client:SupabaseClient,limit:number){
  const out:SamCatalogRow[]=[]
  const pageSize=1000
  for(let from=0;from<limit;from+=pageSize){
    const to=Math.min(limit,from+pageSize)-1
    const {data,error}=await client
      .from('jhadina_sam_catalog')
      .select('notice_id,title,notice_type,posted_date,naics_codes,classification_codes,set_aside,agency,office,description,source_url,raw,last_seen_at')
      .order('last_seen_at',{ascending:false})
      .range(from,to)
      .returns<SamCatalogRow[]>()
    if(error)throw new Error(`government_demand_sam_read_failed:${error.message}`)
    const rows=data??[]
    out.push(...rows)
    if(rows.length<pageSize)break
  }
  return out
}

async function loadRecentPublicAwards(client:SupabaseClient,limit:number){
  const {data,error}=await client
    .from('jhadina_public_awards')
    .select('id,opportunity_id,title,buyer,awarded_prime_name,awarded_prime_ref,award_amount,naics_code,psc_code,scope_text,award_date,source_url,captured_at,evidence_refs')
    .order('captured_at',{ascending:false})
    .limit(limit)
    .returns<PublicAwardRow[]>()
  if(error)throw new Error(`government_demand_public_awards_read_failed:${error.message}`)
  return data??[]
}

function parseLastIsoDate(value:string):string|undefined{
  const matches=[...value.matchAll(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/g)]
  const match=matches.at(-1)
  if(!match)return undefined
  const month=String(Number(match[2])).padStart(2,'0')
  const day=String(Number(match[3])).padStart(2,'0')
  const candidate=`${match[1]}-${month}-${day}`
  const parsed=Date.parse(candidate+'T00:00:00Z')
  return Number.isFinite(parsed)?candidate:undefined
}

type PriorPerformanceEvidence={
  period:string
  endDate:string
  incumbentName?:string
  evidenceRefs:string[]
}

function findPriorPerformanceEvidence(value:unknown):PriorPerformanceEvidence[]{
  const out:PriorPerformanceEvidence[]=[]
  const visit=(node:unknown)=>{
    if(Array.isArray(node)){for(const item of node)visit(item);return}
    const obj=asObject(node)
    if(!obj)return
    const period=clean(obj.priorPeriodOfPerformance)||clean(obj.prior_period_of_performance)
    if(period){
      const endDate=parseLastIsoDate(period)
      const evidenceRefs=uniq(Array.isArray(obj.evidenceRefs)?obj.evidenceRefs.filter((x):x is string=>typeof x==='string'):[])
      if(endDate&&evidenceRefs.length){
        out.push({
          period,
          endDate,
          incumbentName:clean(obj.incumbentProviderName)||clean(obj.incumbent_provider_name)||undefined,
          evidenceRefs,
        })
      }
    }
    for(const child of Object.values(obj))visit(child)
  }
  visit(value)
  return out
}

async function loadRecompeteEvidence(
  client:SupabaseClient,
  catalogByNotice:Map<string,SamCatalogRow>,
  limit:number,
):Promise<GovernmentDemandObservation[]>{
  const {data,error}=await client
    .from('jhadina_sam_analysis')
    .select('notice_id,operating')
    .order('analyzed_at',{ascending:false})
    .limit(limit)
    .returns<SamAnalysisRow[]>()
  if(error)throw new Error(`government_recompete_analysis_read_failed:${error.message}`)
  const out:GovernmentDemandObservation[]=[]
  for(const row of data??[]){
    const notice=catalogByNotice.get(row.notice_id)
    if(!notice)continue
    const buyer=clean(notice.office)||clean(notice.agency)
    if(!buyer)continue
    for(const [index,evidence] of findPriorPerformanceEvidence(row.operating).entries()){
      out.push({
        id:`recompete-evidence:${row.notice_id}:${index}`,
        buyer,
        title:notice.title,
        stage:'award',
        naicsCodes:notice.naics_codes??[],
        pscCodes:notice.classification_codes??[],
        keywords:keywordTokens(`${notice.title} ${notice.description??''}`),
        incumbentName:evidence.incumbentName,
        performanceEndDate:evidence.endDate,
        sourceRefs:evidence.evidenceRefs,
      } as GovernmentDemandObservation & {incumbentName?:string})
    }
  }
  return out
}

function explicitQaQuestions(text:string,evidenceRef:string):SolicitationQuestion[]{
  if(!/(questions?\s*(?:and|&)\s*answers?|\bq\s*&\s*a\b|(?:^|\n)\s*(?:q|question)\s*#?\d*\s*[:.)-])/im.test(text))return[]
  const lines=text.replace(/\r/g,'').split('\n').map(line=>line.trim()).filter(Boolean)
  const out:SolicitationQuestion[]=[]
  for(let index=0;index<lines.length;index+=1){
    const line=lines[index]!
    const q=line.match(/^(?:q(?:uestion)?)[\s#.-]*(\d+)?\s*[:.)-]\s*(.+)$/i)
    if(!q?.[2])continue
    let answer:string|undefined
    for(let offset=1;offset<=3&&index+offset<lines.length;offset+=1){
      const candidate=lines[index+offset]!
      const a=candidate.match(/^(?:a(?:nswer)?)[\s#.-]*(?:\d+)?\s*[:.)-]\s*(.+)$/i)
      if(a?.[1]){answer=a[1].trim();break}
      if(/^(?:q(?:uestion)?)[\s#.-]*(?:\d+)?\s*[:.)-]/i.test(candidate))break
    }
    out.push({
      id:`qa:${createHash('sha256').update(`${evidenceRef}\n${index}\n${q[2]}`).digest('hex').slice(0,24)}`,
      question:q[2].trim(),
      answer,
      sourceRef:evidenceRef,
    })
  }
  return out
}

async function loadQaSignals(client:SupabaseClient,limit:number){
  const {data,error}=await client
    .from('jhadina_sam_documents')
    .select('id,notice_id,source_url,source_kind,checksum,extracted_text,fetch_status,evidence')
    .eq('fetch_status','ok')
    .not('extracted_text','is',null)
    .order('fetched_at',{ascending:false})
    .limit(limit)
    .returns<SamDocumentRow[]>()
  if(error)throw new Error(`government_qa_documents_read_failed:${error.message}`)
  const byNotice=new Map<string,SolicitationQuestion[]>()
  for(const row of data??[]){
    const evidenceRef=`sam-document:${row.id}:${row.checksum}`
    const questions=explicitQaQuestions(row.extracted_text??'',evidenceRef)
    if(!questions.length)continue
    byNotice.set(row.notice_id,[...(byNotice.get(row.notice_id)??[]),...questions])
  }
  return [...byNotice.entries()].map(([noticeId,questions])=>({
    noticeId,
    signal:analyzeSolicitationQa(questions),
  }))
}

export async function refreshGovernmentDemandRadar(
  client:SupabaseClient,
  input:{samLimit?:number;publicAwardLimit?:number;analysisLimit?:number;documentLimit?:number;now?:string}={},
){
  const now=input.now??new Date().toISOString()
  const samLimit=Math.max(1000,Math.min(input.samLimit??boundedInt(process.env.GOVERNMENT_DEMAND_RADAR_SAM_LIMIT,20000,1000,50000),50000))
  const publicAwardLimit=Math.max(100,Math.min(input.publicAwardLimit??5000,20000))
  const analysisLimit=Math.max(100,Math.min(input.analysisLimit??5000,20000))
  const documentLimit=Math.max(100,Math.min(input.documentLimit??5000,20000))

  const [samRows,publicAwards,qaSignals]=await Promise.all([
    loadRecentSamCatalog(client,samLimit),
    loadRecentPublicAwards(client,publicAwardLimit),
    loadQaSignals(client,documentLimit),
  ])
  const samObservations=samRows.flatMap(row=>{
    const observation=samObservation(row)
    return observation?[observation]:[]
  })
  const publicObservations=publicAwards.map(publicAwardObservation)
  const observations=[...samObservations,...publicObservations]
  const profiles=buildGovernmentDemandProfiles(observations)

  if(profiles.length){
    const rows=profiles.map(profile=>({
      id:profileId(profile.buyer),
      buyer:profile.buyer,
      observation_count:profile.observationCount,
      award_count:profile.awardCount,
      naics_codes:profile.distinctNaicsCodes,
      psc_codes:profile.distinctPscCodes,
      recurring_keywords:profile.recurringKeywords,
      observed_vehicles:profile.observedVehicles,
      incumbent_names:profile.incumbentNames,
      evidence_refs:profile.evidenceRefs,
      refreshed_at:now,
      updated_at:now,
    }))
    const {error}=await client.from('jhadina_government_demand_profiles').upsert(rows,{onConflict:'id'})
    if(error)throw new Error(`government_demand_profile_persist_failed:${error.message}`)
  }

  const catalogByNotice=new Map(samRows.map(row=>[row.notice_id,row]))
  const recompeteEvidence=await loadRecompeteEvidence(client,catalogByNotice,analysisLimit)
  const watches=buildRecompeteWatches({observations:recompeteEvidence,now})
  if(watches.length){
    const {error}=await client.from('jhadina_government_recompete_watches').upsert(
      watches.map(watch=>({
        observation_id:watch.observationId,
        buyer:watch.buyer,
        title:watch.title,
        incumbent_name:watch.incumbentName??null,
        performance_end_date:watch.performanceEndDate,
        watch_start_date:watch.watchStartDate,
        days_until_watch:watch.daysUntilWatch,
        status:watch.status,
        evidence_refs:watch.evidenceRefs,
        refreshed_at:now,
        updated_at:now,
      })),
      {onConflict:'observation_id'},
    )
    if(error)throw new Error(`government_recompete_watch_persist_failed:${error.message}`)
  }

  if(qaSignals.length){
    const {error}=await client.from('jhadina_government_solicitation_qa_signals').upsert(
      qaSignals.map(({noticeId,signal})=>({
        notice_id:noticeId,
        question_count:signal.questionCount,
        answered_count:signal.answeredCount,
        topics:signal.topics,
        unresolved_topics:signal.unresolvedTopics,
        engagement_signal:signal.engagementSignal,
        competition_inference_authorized:false,
        reasons:signal.reasons,
        evidence_refs:signal.evidenceRefs,
        refreshed_at:now,
        updated_at:now,
      })),
      {onConflict:'notice_id'},
    )
    if(error)throw new Error(`government_qa_signal_persist_failed:${error.message}`)
  }

  return {
    status:'PASS' as const,
    refreshedAt:now,
    samObservations:samObservations.length,
    publicAwardObservations:publicObservations.length,
    buyerProfiles:profiles.length,
    recompeteWatches:watches.length,
    qaSignals:qaSignals.length,
    competitionInferenceAuthorized:false as const,
    externalContactAuthorized:false as const,
    bidSubmissionAuthorized:false as const,
  }
}
