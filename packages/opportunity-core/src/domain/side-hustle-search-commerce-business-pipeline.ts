import type { VentureWorkItem } from './venture-factory.js'
import type {
  SearchCommerceDueTask,
  SearchCommerceDueTaskQueue,
} from './side-hustle-search-commerce-task-engine.js'

export type SearchCommerceBusinessPipelineItem = {
  taskId: string
  routineId: SearchCommerceDueTask['routineId']
  cadence: SearchCommerceDueTask['cadence']
  priority: SearchCommerceDueTask['priority']
  businessPipelineStatus: 'queued' | 'blocked'
  missingInputs: readonly string[]
  ventureWorkItem: VentureWorkItem
  authority: 'SIDE_HUSTLE_BUSINESS_PIPELINE_WORK_ONLY'
  externalActionAuthorized: false
  publishingAuthorized: false
  promotionAuthorized: false
  purchasingAuthorized: false
  moneyMovementAuthorized: false
}

export type SearchCommerceBusinessPipelineProjection = {
  ventureId: string
  family: SearchCommerceDueTaskQueue['family']
  businessDate: string
  items: readonly SearchCommerceBusinessPipelineItem[]
  authority: 'SIDE_HUSTLE_BUSINESS_PIPELINE_PROJECTION_ONLY'
  externalActionAuthorized: false
  moneyMovementAuthorized: false
}

export function projectSearchCommerceToBusinessPipeline(input: {
  ventureId: string
  queue: SearchCommerceDueTaskQueue
  observedAt: string
  evidenceRefs: readonly string[]
  agentId?: string
}): SearchCommerceBusinessPipelineProjection {
  const ventureId = requireText(input.ventureId, 'ventureId')
  const observedAt = normalizeDate(input.observedAt)
  const evidenceRefs = unique(input.evidenceRefs)
  if (evidenceRefs.length === 0) {
    throw new Error('Search Commerce business-pipeline projection requires evidence references')
  }

  const agentId = requireText(input.agentId ?? 'marisa:operations', 'agentId')
  const items = input.queue.dueTasks.map((task) =>
    projectTask({
      ventureId,
      task,
      observedAt,
      evidenceRefs,
      agentId,
    }),
  )

  return Object.freeze({
    ventureId,
    family: input.queue.family,
    businessDate: input.queue.businessDate,
    items: Object.freeze(items),
    authority: 'SIDE_HUSTLE_BUSINESS_PIPELINE_PROJECTION_ONLY',
    externalActionAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

function projectTask(input: {
  ventureId: string
  task: SearchCommerceDueTask
  observedAt: string
  evidenceRefs: readonly string[]
  agentId: string
}): SearchCommerceBusinessPipelineItem {
  const status: SearchCommerceBusinessPipelineItem['businessPipelineStatus'] =
    input.task.missingInputs.length > 0 ? 'blocked' : 'queued'

  const ventureWorkItem: VentureWorkItem = Object.freeze({
    id: `business-work:${input.ventureId}:${input.task.routineId}:${input.task.businessDate}`,
    ventureId: input.ventureId,
    agentId: input.agentId,
    step: `search_commerce:${input.task.routineId}`,
    status,
    createdAt: input.observedAt,
    updatedAt: input.observedAt,
    evidenceRefs: unique([
      ...input.evidenceRefs,
      input.task.id,
    ]),
    outputRefs: [],
    spendUsd: 0,
    authorizationEffect: 'NONE',
  })

  return Object.freeze({
    taskId: input.task.id,
    routineId: input.task.routineId,
    cadence: input.task.cadence,
    priority: input.task.priority,
    businessPipelineStatus: status,
    missingInputs: Object.freeze([...input.task.missingInputs]),
    ventureWorkItem,
    authority: 'SIDE_HUSTLE_BUSINESS_PIPELINE_WORK_ONLY',
    externalActionAuthorized: false,
    publishingAuthorized: false,
    promotionAuthorized: false,
    purchasingAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`Search Commerce business-pipeline ${field} is required`)
  return normalized
}

function normalizeDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) {
    throw new Error('Search Commerce business-pipeline observedAt must be a valid date')
  }
  return new Date(parsed).toISOString()
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
