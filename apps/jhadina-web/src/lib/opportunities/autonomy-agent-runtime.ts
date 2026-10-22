import { randomUUID } from 'node:crypto'
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
  const now=input.now ?? (()=>new Date().toISOString())
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
