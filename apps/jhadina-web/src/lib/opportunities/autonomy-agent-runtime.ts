import { randomUUID,createHash } from 'node:crypto'
import type { VerifiedPublicExcerpt } from './public-source-verifier'
import {
  DurableAgentRuntime,
  type AgentRuntimeRepository,
  type AgentPlan,
  type AgentPolicyDecision,
  type AgentPlanStep,
} from '@jhadina/agent-runtime-core'
import {
  buildSourceBoundInternalPilot,
  type Opportunity,
  type OpportunityPilotSourceCheck,
  type ServicePilotInput,
} from '@jhadina/opportunity-core'

/**
 * Reuses the canonical durable Agent Runtime repository; there is no new work queue.
 * The single capability is internal report preparation. No provider actions or money.
 */
export async function runSourceBoundOpportunityPilot(input: {
  ownerId: string
  opportunity: Opportunity
  pilot: ServicePilotInput
  observations: OpportunityPilotSourceCheck[]
  sourceReceipts?: VerifiedPublicExcerpt[]
  repository: AgentRuntimeRepository
  now?: () => string
}) {
  if (!input.ownerId.trim()) throw new Error('Owner identity required')
  const admission = buildSourceBoundInternalPilot({
    opportunity:input.opportunity,pilot:input.pilot,observations:input.observations,
  })
  if (!admission.admitted || !admission.draft) {
    return {
      accepted:false as const, blockers:admission.blockers,
      runId:null, document:null, externalActionAuthorized:false as const,
    }
  }
  if(input.sourceReceipts){
    const byId=new Map(input.sourceReceipts.map(r=>[r.evidenceId,r]))
    if(input.sourceReceipts.length!==input.observations.length ||
      input.observations.some(o=>{
        const r=byId.get(o.evidenceId)
        return !r || r.sourceUrl!==o.sourceUrl || r.confirmedExcerpt!==o.excerpt ||
          !/^[a-f0-9]{64}$/.test(r.contentSha256) || r.externalActionAuthorized!==false
      }))throw Error('Source hash receipts do not match approved source observations')
  }
  const reportSha256=createHash('sha256').update(admission.draft.document).digest('hex')
  const wallClock=input.now ?? (()=>new Date().toISOString())
  // The existing Agent Runtime retrieves its latest checkpoint by timestamp.
  // Several same-millisecond writes would otherwise make terminal recovery ambiguous.
  let lastTick=0
  const now=()=>{
    const observed=Date.parse(wallClock())
    if(!Number.isFinite(observed))throw new Error('Invalid worker clock')
    lastTick=Math.max(observed,lastTick+1)
    return new Date(lastTick).toISOString()
  }
  const runtime = new DurableAgentRuntime(
    input.repository,
    {
      evaluate:async({run,step}) => ({
        id:'oce-policy:'+randomUUID(),runId:run.id,stepId:step.id,
        allowed:step.capability==='opportunity_internal_research' &&
          step.operation==='prepare_source_bound_pilot' &&
          step.consequenceLevel==='low',
        requiredApproval:false,
        reason:'Source-bound internal draft only; no external delivery or payments.',
        evaluatedAt:now(),
      } satisfies AgentPolicyDecision),
    },
    {
      execute:async ({step,policy})=>{
        if (!policy.allowed || step.operation!=='prepare_source_bound_pilot') throw new Error('OCE_ACTION_DENIED')
        // No network, external mutation, customer engagement, publication, spending or payment.
        return {
          kind:'source_bound_internal_draft',
          document:admission.draft!.document,
          state:admission.draft!.state,
          evidenceRefs:input.observations.map(row=>row.evidenceId),
          sourceHashes:(input.sourceReceipts??[]).map(r=>({evidenceId:r.evidenceId,sourceUrl:r.sourceUrl,sha256:r.contentSha256})),
          reportSha256,
          externalActionAuthorized:false,
          paymentAuthorized:false,
        }
      },
    },
    async({run,revision}) => ({
      id:'oce-plan:'+randomUUID(),runId:run.id,revision,
      objective:run.objective,
      rationale:'Prepare only source-attested internal work; customer work stays governed by commercial runtime.',
      createdAt:now(),
      steps:[{
        id:'oce-plan-step:'+randomUUID(),ordinal:1,
        capability:'opportunity_internal_research',
        operation:'prepare_source_bound_pilot',
        input:{opportunityId:input.opportunity.id,templateId:admission.draft!.templateId},
        consequenceLevel:'low',
      } satisfies AgentPlanStep],
    } satisfies AgentPlan),
    {next:(prefix)=>prefix+':oce:'+input.ownerId+':'+randomUUID()},
    now,
  )
  const run=await runtime.createRun('OCE internal pilot '+input.opportunity.id)
  await runtime.plan(run.id)
  const step=await runtime.executeNext(run.id)
  if (step.status!=='completed') throw new Error('Pilot execution failed closed: '+(step.error??'unknown'))
  await runtime.executeNext(run.id) // canonical runtime terminal checkpoint
  const terminal=await input.repository.getRun(run.id)
  if (terminal?.status!=='completed') throw new Error('Pilot terminal state not durably confirmed')
  return {
    accepted:true as const,runId:run.id,
    blockers:[] as string[],
    document:admission.draft.document,
    reportSha256,
    resultState:'internal_complete_awaiting_owner_review' as const,
    externalActionAuthorized:false as const,
    customerAcceptanceVerified:false as const,
    paidOutcomeVerified:false as const,
  }
}

export function assertOwnerScopedPilotRunId(runId:string,ownerId:string) {
  if (!ownerId.trim() || !runId.startsWith('agent-run:oce:'+ownerId+':') ||
      !/^agent-run:oce:[0-9a-f-]{36}:[0-9a-f-]{36}$/i.test(runId)) {
    throw new Error('OCE_PILOT_OWNER_SCOPE_DENIED')
  }
}

/** Cold-read a completed owner run from the shared durable agent repository.
 * Provides the original report and source hashes after browser refresh/restart.
 * Never trusts client-supplied status, document or execution receipts.
 */
export async function readOwnerPilotRun(input:{
  ownerId:string
  runId:string
  repository:AgentRuntimeRepository
}) {
  assertOwnerScopedPilotRunId(input.runId,input.ownerId)
  const run=await input.repository.getRun(input.runId)
  if(!run)return undefined
  const checkpoint=await input.repository.getLatestCheckpoint(run.id)
  const step=run.currentStepId?await input.repository.getStep(run.currentStepId):undefined
  if(step && (step.runId!==run.id || step.operation!=='prepare_source_bound_pilot'))throw Error('Unexpected agent execution lineage')
  const output=step?.status==='completed' && step.output && typeof step.output==='object'
    ? step.output as Record<string,unknown> : null
  const original=output && output.kind==='source_bound_internal_draft'&&typeof output.document==='string'
    ? output.document : null
  const document=original && original.length<=160_000?original:null
  const reportSha256=output && typeof output.reportSha256==='string'?output.reportSha256:null
  if(document && reportSha256!==createHash('sha256').update(document).digest('hex')){
    throw Error('Persisted report digest mismatch')
  }
  return {
    id:run.id,status:run.status,version:run.version,updatedAt:run.updatedAt,
    checkpoint:checkpoint?{reason:checkpoint.reason,createdAt:checkpoint.createdAt,planRevision:checkpoint.planRevision}:null,
    result:run.status==='completed'&&document?{
      document,reportSha256,
      sourceHashes:Array.isArray(output?.sourceHashes)?output.sourceHashes:[],
      internalDraftOnly:true as const,customerDeliveryAuthorized:false as const,paymentAuthorized:false as const,
    }:null,
    externalActionAuthorized:false as const,
  }
}
