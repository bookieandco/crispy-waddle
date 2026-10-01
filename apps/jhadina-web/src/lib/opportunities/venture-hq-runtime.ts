import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createVentureWorkflow,
  projectVentureHq,
  type VentureAgent,
  type VentureHqRoom,
  type VentureWorkflow,
} from '@jhadina/opportunity-core'
import { VentureRuntimeRepository } from './venture-runtime-repository'

const CORE_AGENTS: readonly VentureAgent[] = [
  {
    id: 'jhadina:executive',
    name: 'Jhadina',
    class: 'supervisor',
    capabilities: ['portfolio_governance', 'arbitration', 'final_context'],
    executionOwners: ['jhadina'],
    maxConcurrentWork: 8,
    active: true,
  },
  {
    id: 'janet:memory',
    name: 'Janet',
    class: 'researcher',
    capabilities: ['memory_context', 'cross_venture_learning', 'evidence_recall'],
    executionOwners: ['memory', 'opportunity'],
    maxConcurrentWork: 4,
    active: true,
  },
  {
    id: 'delia:strategy',
    name: 'Delia',
    class: 'analyst',
    capabilities: ['venture_strategy', 'make_it_make_sense', 'portfolio_analysis'],
    executionOwners: ['opportunity', 'growth'],
    maxConcurrentWork: 4,
    active: true,
  },
  {
    id: 'marisa:operations',
    name: 'Marisa',
    class: 'operator',
    capabilities: ['workflow_operations', 'queue_supervision', 'repair_routing'],
    executionOwners: ['opportunity'],
    maxConcurrentWork: 8,
    active: true,
  },
] as const

const CORE_WORKFLOW: VentureWorkflow = createVentureWorkflow({
  id: 'workflow:venture-hq:canonical',
  name: 'Canonical venture evidence loop',
  nodes: [
    { id: 'memory', agentClass: 'researcher', capability: 'memory_context' },
    { id: 'strategy', agentClass: 'analyst', capability: 'venture_strategy' },
    { id: 'operations', agentClass: 'operator', capability: 'workflow_operations' },
    { id: 'governance', agentClass: 'supervisor', capability: 'portfolio_governance' },
  ],
  edges: [
    { from: 'memory', to: 'strategy' },
    { from: 'strategy', to: 'operations' },
    { from: 'operations', to: 'governance' },
  ],
  limits: {
    maxHops: 8,
    maxUsdPerWorkItem: 5,
    maxUsdPerDay: 100,
  },
})

function inferredWorkerAgents(
  workItems: Awaited<ReturnType<VentureRuntimeRepository['listWorkItems']>>,
): VentureAgent[] {
  const coreIds = new Set(CORE_AGENTS.map((agent) => agent.id))
  const byId = new Map<string, VentureAgent>()
  for (const item of workItems) {
    if (coreIds.has(item.agentId) || byId.has(item.agentId)) continue
    byId.set(item.agentId, {
      id: item.agentId,
      name: item.agentId,
      class: 'operator',
      capabilities: [item.step],
      executionOwners: ['venture_execution_owner'],
      maxConcurrentWork: 1,
      active: !['completed', 'failed'].includes(item.status),
    })
  }
  return [...byId.values()]
}

export async function buildVentureHqProjection(
  client: SupabaseClient,
  ownerUserId: string,
  input: { now?: string; recordReceipt?: boolean } = {},
) {
  const repository = new VentureRuntimeRepository(client)
  const now = input.now ?? new Date().toISOString()
  const [ventures, workItems, memory, issues] = await Promise.all([
    repository.listVentures(ownerUserId),
    repository.listWorkItems(ownerUserId),
    repository.listMemory(ownerUserId),
    repository.listSupervisorIssues(ownerUserId),
  ])

  const workers = inferredWorkerAgents(workItems)
  const agents = [...CORE_AGENTS.map((agent) => ({ ...agent, capabilities: [...agent.capabilities], executionOwners: [...agent.executionOwners] })), ...workers]
  const workerIds = workers.map((agent) => agent.id)

  const rooms: VentureHqRoom[] = [
    {
      id: 'office:jhadina',
      name: 'Jhadina Executive Command',
      capabilityScope: ['portfolio_governance', 'arbitration', 'final_context'],
      agentIds: ['jhadina:executive'],
      workflowIds: [CORE_WORKFLOW.id],
    },
    {
      id: 'office:janet',
      name: 'Janet Memory & Context',
      capabilityScope: ['memory_context', 'cross_venture_learning', 'evidence_recall'],
      agentIds: ['janet:memory'],
      workflowIds: [CORE_WORKFLOW.id],
    },
    {
      id: 'office:delia',
      name: 'Delia Strategy & Intelligence',
      capabilityScope: ['venture_strategy', 'make_it_make_sense', 'portfolio_analysis'],
      agentIds: ['delia:strategy'],
      workflowIds: [CORE_WORKFLOW.id],
    },
    {
      id: 'office:marisa',
      name: 'Marisa Operations & Execution',
      capabilityScope: ['workflow_operations', 'queue_supervision', 'repair_routing'],
      agentIds: ['marisa:operations'],
      workflowIds: [CORE_WORKFLOW.id],
    },
    {
      id: 'floor:venture-workers',
      name: 'Venture Factory Floor',
      capabilityScope: ['bounded_worker_execution'],
      agentIds: workerIds,
      workflowIds: [CORE_WORKFLOW.id],
    },
  ]

  const projection = projectVentureHq({
    rooms,
    agents,
    workItems,
    workflows: [CORE_WORKFLOW],
    generatedAt: now,
  })

  const evidenceRefs = [...new Set([
    ...ventures.flatMap((venture) => venture.evidenceRefs),
    ...workItems.flatMap((item) => item.evidenceRefs),
    ...memory.flatMap((record) => record.evidenceRefs),
    ...issues.flatMap((issue) => issue.evidenceRefs),
  ])]

  if (input.recordReceipt !== false) {
    await repository.recordReceipt({
      id: `venture-hq-receipt:${now.replace(/[^0-9A-Za-z]/g, '').slice(0, 24)}`,
      ownerUserId,
      kind: 'spatial_projection',
      evidenceRefs: evidenceRefs.length ? evidenceRefs : [`venture-hq:${now}`],
      payload: {
        generatedAt: projection.generatedAt,
        ventureCount: ventures.length,
        agentCount: projection.agents.length,
        workItemCount: projection.workItems.length,
        memoryCount: memory.length,
        openSupervisorIssues: issues.length,
        ledger: projection.ledger,
        law: projection.law,
        visualThemeAuthorized: false,
      },
      recordedAt: now,
    })
  }

  return {
    projection,
    summary: {
      ventureCount: ventures.length,
      memoryCount: memory.length,
      openSupervisorIssues: issues.length,
      namedOffices: {
        janet: 'memory_context',
        delia: 'strategy_intelligence',
        marisa: 'operations_execution',
        jhadina: 'executive_command',
      },
    },
    visualRenderingImplemented: false as const,
  }
}
