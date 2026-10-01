import type { SupabaseClient } from '@supabase/supabase-js'
import type { UsStateOrDcCode } from '@jhadina/opportunity-core'
import { discoverPublicComplianceSources } from './public-compliance-source-provider'

type JobRow={
  state_code:UsStateOrDcCode
  status:'pending'|'sources_discovered'|'pack_review_required'|'verified'|'blocked'
  attempt_count:number
}

function discoveryConfigured(){
  return Boolean(
    (process.env.WEB_SEARCH_URL?.trim()&&process.env.WEB_SEARCH_API_KEY?.trim())||
    process.env.EXA_API_KEY?.trim()
  )
}

export async function commissionPublicComplianceSourceBatch(
  client:SupabaseClient,
  input:{batchSize?:number;queryBudget?:number;now?:string;fetchImpl?:typeof fetch}={},
){
  if(!discoveryConfigured())throw new Error('PUBLIC_COMPLIANCE_SEARCH_NOT_CONFIGURED')
  const now=input.now??new Date().toISOString()
  const batchSize=Math.max(1,Math.min(input.batchSize??2,10))
  const queryBudget=Math.max(1,Math.min(input.queryBudget??2,3))

  const {data,error}=await client
    .from('jhadina_public_compliance_source_jobs')
    .select('state_code,status,attempt_count')
    .in('status',['pending','sources_discovered','pack_review_required'])
    .order('attempt_count',{ascending:true})
    .order('updated_at',{ascending:true})
    .limit(batchSize)
    .returns<JobRow[]>()
  if(error)throw new Error(`public_compliance_source_queue_read_failed:${error.message}`)
  if(!data?.length){
    return {status:'IDLE' as const,states:0,verifiedSources:0,packReviewRequired:0,externalActionAuthorized:false as const}
  }

  const results=[]
  for(const job of data){
    try{
      const discovery=await discoverPublicComplianceSources({
        state:job.state_code,
        queryBudget,
        fetchImpl:input.fetchImpl,
        now,
      })
      if(discovery.candidates.length){
        const rows=discovery.candidates.map(candidate=>({
          id:candidate.id,
          state_code:candidate.state,
          source_name:candidate.sourceName,
          source_url:candidate.sourceUrl,
          topics:candidate.topics,
          discovery_provider:discovery.provider,
          government_domain:candidate.governmentDomain,
          state_relevant:candidate.stateRelevant,
          official_source_verified:candidate.officialSourceVerified,
          confidence:candidate.confidence,
          evidence_refs:candidate.evidenceRefs,
          blockers:candidate.blockers,
          observed_at:now,
          last_seen_at:now,
          updated_at:now,
        }))
        const {error:persistError}=await client
          .from('jhadina_public_compliance_source_candidates')
          .upsert(rows,{onConflict:'state_code,source_url'})
        if(persistError)throw new Error(`public_compliance_source_candidate_persist_failed:${persistError.message}`)
      }

      const verifiedRefs=discovery.candidates.filter(candidate=>candidate.officialSourceVerified).map(candidate=>candidate.sourceUrl)
      const nextStatus=discovery.coverage.coveredTopics.length>=4?'pack_review_required':
        discovery.coverage.verifiedSourceCount>0?'sources_discovered':'pending'
      const {error:updateError}=await client
        .from('jhadina_public_compliance_source_jobs')
        .update({
          status:nextStatus,
          source_refs:verifiedRefs,
          last_attempt_at:now,
          attempt_count:job.attempt_count+1,
          last_error:null,
          updated_at:now,
        })
        .eq('state_code',job.state_code)
      if(updateError)throw new Error(`public_compliance_source_job_update_failed:${updateError.message}`)

      const {error:packError}=await client
        .from('jhadina_public_compliance_packs')
        .update({
          source_refs:verifiedRefs,
          updated_at:now,
        })
        .eq('state_code',job.state_code)
      if(packError)throw new Error(`public_compliance_pack_source_update_failed:${packError.message}`)

      results.push({
        state:job.state_code,
        status:nextStatus,
        verifiedSources:discovery.coverage.verifiedSourceCount,
        coveredTopics:discovery.coverage.coveredTopics,
        coveragePct:discovery.coverage.coveragePct,
        packAutoVerificationAuthorized:false as const,
      })
    }catch(error){
      const message=error instanceof Error?error.message:'public_compliance_source_discovery_failed'
      const {error:updateError}=await client
        .from('jhadina_public_compliance_source_jobs')
        .update({
          last_attempt_at:now,
          attempt_count:job.attempt_count+1,
          last_error:message,
          updated_at:now,
        })
        .eq('state_code',job.state_code)
      if(updateError)throw new Error(`public_compliance_source_error_update_failed:${updateError.message}`)
      results.push({
        state:job.state_code,
        status:'retryable_error' as const,
        verifiedSources:0,
        coveredTopics:[],
        coveragePct:0,
        packAutoVerificationAuthorized:false as const,
        error:message,
      })
    }
  }

  return {
    status:'PROCESSED' as const,
    states:results.length,
    verifiedSources:results.reduce((sum,row)=>sum+row.verifiedSources,0),
    packReviewRequired:results.filter(row=>row.status==='pack_review_required').length,
    results,
    externalActionAuthorized:false as const,
    packAutoVerificationAuthorized:false as const,
  }
}
