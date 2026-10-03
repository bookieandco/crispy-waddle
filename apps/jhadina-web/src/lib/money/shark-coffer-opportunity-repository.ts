import type {SupabaseClient} from '@supabase/supabase-js'
import type {StagedMakeItMakeSenseVote} from '@jhadina/core-spine'
import {
  adaptSharkResearchToPurseOpportunity,
  ingestPurseOpportunity,
  type JhadinaPurseCharter,
  type OpportunityCandidateV2,
  type PurseOpportunityEnvelope,
  type SharkMoneyResearchArtifact,
  type SharkPurseMoneyValidation,
} from '@jhadina/money-core'

export type SharkCofferAppendDisposition='INSERTED'|'REPLAY'

const encode=(value:unknown)=>JSON.parse(JSON.stringify(value,(_,x)=>typeof x==='bigint'?x.toString():x))

export async function appendSharkCofferOpportunity(
  client:SupabaseClient,
  input:Readonly<{
    charter:JhadinaPurseCharter
    envelope:PurseOpportunityEnvelope
  }>,
):Promise<SharkCofferAppendDisposition>{
  const {charter,envelope}=input
  if(envelope.authority!=='OPPORTUNITY_BUS_ONLY'||envelope.canExecute!==false)throw new Error('SHARK_COFFER_OPPORTUNITY_ENVELOPE_AUTHORITY_INVALID')
  if(envelope.charterId!==charter.charterId)throw new Error('SHARK_COFFER_OPPORTUNITY_CHARTER_MISMATCH')
  if(envelope.opportunity.sourceKind!=='SHARK'||envelope.opportunity.lane!=='MEME')throw new Error('SHARK_COFFER_OPPORTUNITY_SOURCE_INVALID')
  if(!envelope.opportunity.governance?.mimsVoteId)throw new Error('SHARK_COFFER_MIMS_REQUIRED')

  const row={
    bus_event_id:envelope.busEventId,
    charter_id:charter.charterId,
    user_id:charter.userId,
    coffer_id:charter.cofferId,
    opportunity_id:envelope.opportunity.opportunityId,
    lane:envelope.opportunity.lane,
    strategy_id:envelope.opportunity.strategyId,
    instrument_id:envelope.opportunity.instrumentId,
    admitted:envelope.admitted,
    reason_codes:[...envelope.reasonCodes],
    opportunity_json:encode(envelope.opportunity),
    ingested_at:envelope.ingestedAt,
    authority:'OPPORTUNITY_BUS_ONLY',
    can_execute:false,
  }
  const {data,error}=await client.from('money_purse_opportunity_events').insert(row).select('bus_event_id').maybeSingle()
  if(!error&&data)return 'INSERTED'
  if(error?.code!=='23505')throw new Error('SHARK_COFFER_OPPORTUNITY_WRITE_FAILED:'+(error?.message??'unknown'))

  const {data:existing,error:readError}=await client
    .from('money_purse_opportunity_events')
    .select('opportunity_id,admitted,reason_codes,opportunity_json')
    .eq('bus_event_id',envelope.busEventId)
    .maybeSingle()
  if(readError||!existing)throw new Error('SHARK_COFFER_OPPORTUNITY_REPLAY_READ_FAILED:'+(readError?.message??'missing'))
  const existingOpportunity=(existing as any).opportunity_json??{}
  if(
    String((existing as any).opportunity_id)!==envelope.opportunity.opportunityId||
    Boolean((existing as any).admitted)!==envelope.admitted||
    String(existingOpportunity.provenanceHash??'')!==envelope.opportunity.provenanceHash||
    String(existingOpportunity.governance?.mimsVoteId??'')!==envelope.opportunity.governance.mimsVoteId||
    String(existingOpportunity.governance?.mimsStatus??'')!==envelope.opportunity.governance.mimsStatus
  )throw new Error('SHARK_COFFER_OPPORTUNITY_EVENT_CONFLICT')
  return 'REPLAY'
}

export async function admitSharkResearchToAutomatedCoffer(
  client:SupabaseClient,
  input:Readonly<{
    charter:JhadinaPurseCharter
    research:SharkMoneyResearchArtifact
    candidate:OpportunityCandidateV2
    tradeMims:StagedMakeItMakeSenseVote<'TRADE'>
    validation:SharkPurseMoneyValidation
    ingestedAt:string
  }>,
):Promise<Readonly<{
  opportunityEnvelope:PurseOpportunityEnvelope
  persistence:SharkCofferAppendDisposition
  canExecute:false
}>>{
  const opportunity=adaptSharkResearchToPurseOpportunity({
    research:input.research,
    candidate:input.candidate,
    tradeMims:input.tradeMims,
    validation:input.validation,
  })
  const opportunityEnvelope=ingestPurseOpportunity({
    charter:input.charter,
    opportunity,
    ingestedAt:input.ingestedAt,
  })
  const persistence=await appendSharkCofferOpportunity(client,{
    charter:input.charter,
    envelope:opportunityEnvelope,
  })
  return Object.freeze({
    opportunityEnvelope,
    persistence,
    canExecute:false,
  })
}
