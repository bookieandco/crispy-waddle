import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildSamPursuitOption,
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

      const option=buildSamPursuitOption({
        noticeId,
        requirements:pursuitRequirements(analysisRow.requirements),
        candidates:pursuitCandidates(candidateRows),
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
        commercial:option.commercial,
        blockers:option.blockers,
        human_approval_required:true,
        outreach_authorized:false,
        bid_submission_authorized:false,
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
