import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assessProviderBench,
  buildSamPursuitOption,
  type ProviderDiscoveryChannel,
  type SamPursuitProviderCandidate,
  type SamPursuitRequirement,
} from '@jhadina/opportunity-core'

const rows=(value:unknown):Record<string,unknown>[]=>Array.isArray(value)
  ?value.filter((row):row is Record<string,unknown>=>Boolean(row&&typeof row==='object'))
  :[]
const str=(value:unknown)=>typeof value==='string'?value.trim():''
const strings=(value:unknown)=>Array.isArray(value)?value.filter((x):x is string=>typeof x==='string'&&x.trim().length>0).map(x=>x.trim()):[]
const num=(value:unknown)=>{
  if(typeof value==='number'&&Number.isFinite(value)&&value>0)return value
  if(typeof value==='string'){
    const parsed=Number(value.replace(/[$,]/g,'').trim())
    return Number.isFinite(parsed)&&parsed>0?parsed:null
  }
  return null
}

export function knownSamContractValue(raw:Record<string,unknown>):number|null{
  const directKeys=['estimatedTotalValue','estimatedValue','contractValue','ceiling','totalValue']
  for(const key of directKeys){
    const value=num(raw[key])
    if(value)return value
  }
  const award=raw.award&&typeof raw.award==='object'?raw.award as Record<string,unknown>:null
  if(award){
    for(const key of ['amount','totalValue','ceiling']){
      const value=num(award[key])
      if(value)return value
    }
  }
  return null
}

function evidenceRefs(value:unknown){
  return rows(value).map(item=>str(item.id)).filter(Boolean)
}

function pursuitRequirements(value:unknown):SamPursuitRequirement[]{
  return rows(value)
    .map((requirement,index)=>({
      id:str(requirement.id)||`requirement:${index+1}`,
      label:str(requirement.label)||'solicitation requirement',
    }))
}

const providerDiscoveryChannels=new Set<ProviderDiscoveryChannel>(['sam_entity','sam_award','usaspending','fpds','entity_directory','local_business','web_search','professional_network','public_social_business_page','marketplace_directory','provider_referral','expert_referral','site_visit_attendee','manual_owner_network'])
function pursuitCandidates(value:unknown):SamPursuitProviderCandidate[]{
  return rows(value).map(row=>{
    const status=str(row.status)
    const normalizedStatus:SamPursuitProviderCandidate['status']=
      status==='candidate'||status==='review_required'||status==='blocked'?status:'review_required'
    return {
      requirementId:str(row.requirement_id),
      providerKey:str(row.provider_key),
      providerName:str(row.provider_name),
      status:normalizedStatus,
      score:typeof row.score==='number'?row.score:Number(row.score??0)||0,
      sources:strings(row.sources),
      evidenceRefs:evidenceRefs(row.evidence),
    }
  }).filter(candidate=>candidate.requirementId&&candidate.providerKey&&candidate.providerName)
}

export async function buildSamPursuitOptions(client:SupabaseClient,noticeIds:string[]){
  let generated=0,teamCovered=0,readyForQuote=0
  const errors:string[]=[]

  for(const noticeId of noticeIds){
    try{
      const [{data:analysis,error:analysisError},{data:catalog,error:catalogError},{data:candidateRows,error:candidateError}]=await Promise.all([
        client.from('jhadina_sam_analysis').select('requirements,subcontractability').eq('notice_id',noticeId).maybeSingle(),
        client.from('jhadina_sam_catalog').select('raw').eq('notice_id',noticeId).maybeSingle(),
        client.from('jhadina_sam_provider_candidates').select('requirement_id,provider_key,provider_name,status,score,sources,evidence').eq('notice_id',noticeId),
      ])
      if(analysisError)throw new Error(`analysis: ${analysisError.message}`)
      if(catalogError)throw new Error(`catalog: ${catalogError.message}`)
      if(candidateError)throw new Error(`providers: ${candidateError.message}`)
      if(!analysis||!catalog)continue

      const analysisRow=analysis as Record<string,unknown>
      const subcontractability=analysisRow.subcontractability&&typeof analysisRow.subcontractability==='object'
        ?analysisRow.subcontractability as Record<string,unknown>
        :{}
      const status=str(subcontractability.status)
      const subcontractabilityStatus:Parameters<typeof buildSamPursuitOption>[0]['subcontractabilityStatus']=
        status==='pass'||status==='conditional'||status==='review_required'||status==='blocked'?status:'review_required'
      const raw=(catalog as Record<string,unknown>).raw
      const rawRecord=raw&&typeof raw==='object'?raw as Record<string,unknown>:{}

      const requirements=pursuitRequirements(analysisRow.requirements)
      const parsedCandidates=pursuitCandidates(candidateRows)
      const benchCandidates=rows(candidateRows).map(row=>({
        providerId:str(row.provider_key),
        requirementIds:[str(row.requirement_id)].filter(Boolean),
        discoveryChannels:strings(row.sources).filter((source):source is ProviderDiscoveryChannel=>providerDiscoveryChannels.has(source as ProviderDiscoveryChannel)),
        evidenceRefs:evidenceRefs(row.evidence),
        qualified:str(row.status)==='candidate',
      })).filter(candidate=>candidate.providerId&&candidate.requirementIds.length)
      const providerBench=requirements.map(requirement=>({
        requirementId:requirement.id,
        ...assessProviderBench(benchCandidates.filter(candidate=>candidate.requirementIds.includes(requirement.id))),
      }))

      const option=buildSamPursuitOption({
        noticeId,
        requirements,
        candidates:parsedCandidates,
        subcontractabilityStatus,
        subcontractabilityBlockers:strings(subcontractability.hardBlockers),
        contractValue:knownSamContractValue(rawRecord),
      })

      const {error}=await client.from('jhadina_sam_pursuit_options').upsert({
        notice_id:noticeId,
        status:option.status,
        assignments:option.assignments,
        covered_requirement_ids:option.coveredRequirementIds,
        uncovered_requirement_ids:option.uncoveredRequirementIds,
        quote_targets:option.quoteTargets,
        provider_bench:providerBench,
        commercial:option.commercial,
        blockers:option.blockers,
        human_approval_required:true,
        outreach_authorized:false,
        bid_submission_authorized:false,
        contract_execution_authorized:false,
        payment_authorized:false,
        generated_at:option.generatedAt,
        updated_at:new Date().toISOString(),
      },{onConflict:'notice_id'})
      if(error)throw new Error(`persistence: ${error.message}`)

      generated+=1
      if(option.assignments.length>0&&option.uncoveredRequirementIds.length===0&&option.status!=='blocked')teamCovered+=1
      if(option.status==='ready_for_quote')readyForQuote+=1
    }catch(error){
      errors.push(`${noticeId}: ${error instanceof Error?error.message:'pursuit option failed'}`)
    }
  }
  return {generated,teamCovered,readyForQuote,errors}
}
