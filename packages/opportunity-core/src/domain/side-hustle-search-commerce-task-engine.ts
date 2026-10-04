import {
  buildSearchCommerceOperatingPlan,
  type SearchCommerceCadence,
  type SearchCommerceEvidenceKey,
  type SearchCommerceOperatingPlan,
  type SearchCommerceRoutine,
  type SearchCommerceRoutineId,
} from './side-hustle-search-commerce-operations.js'
import type {
  SearchCommerceFunnelStage,
  SearchCommerceStorefrontDiagnostic,
} from './side-hustle-search-commerce-storefront.js'
import type { SideHustleFamily } from './side-hustles.js'

export type SearchCommerceTaskPriority = 'normal' | 'high'

export type SearchCommerceDueTask = {
  id: string
  family: SideHustleFamily
  routineId: SearchCommerceRoutineId
  cadence: SearchCommerceCadence
  objective: string
  due: boolean
  priority: SearchCommerceTaskPriority
  requiredInputs: readonly SearchCommerceEvidenceKey[]
  missingInputs: readonly SearchCommerceEvidenceKey[]
  produces: readonly string[]
  lastCompletedDate?: string
  businessDate: string
  periodKey: string
  authority: 'SEARCH_COMMERCE_TASK_PLANNING_ONLY'
  externalActionAuthorized: false
  publishingAuthorized: false
  promotionAuthorized: false
  purchasingAuthorized: false
  moneyMovementAuthorized: false
}

export type SearchCommerceDueTaskQueue = {
  family: SideHustleFamily
  businessDate: string
  tasks: readonly SearchCommerceDueTask[]
  dueTasks: readonly SearchCommerceDueTask[]
  blockedDueTasks: readonly SearchCommerceDueTask[]
  authority: 'SEARCH_COMMERCE_TASK_QUEUE_ONLY'
  externalActionAuthorized: false
  publishingAuthorized: false
  promotionAuthorized: false
  purchasingAuthorized: false
  moneyMovementAuthorized: false
}

export function buildSearchCommerceDueTaskQueue(input: {
  family: SideHustleFamily
  businessDate: string
  lastCompletedDateByRoutine?: Partial<Record<SearchCommerceRoutineId, string>>
  availableInputKeys?: readonly SearchCommerceEvidenceKey[]
  diagnostic?: SearchCommerceStorefrontDiagnostic
  plan?: SearchCommerceOperatingPlan
}): SearchCommerceDueTaskQueue {
  const businessDate = normalizeBusinessDate(input.businessDate)
  const plan = input.plan ?? buildSearchCommerceOperatingPlan({
    family: input.family,
    generatedAt: businessDate + 'T12:00:00.000Z',
  })

  if (plan.family !== input.family) {
    throw new Error('Search Commerce due-task plan family mismatch')
  }
  if (input.diagnostic && input.diagnostic.family !== input.family) {
    throw new Error('Search Commerce due-task diagnostic family mismatch')
  }

  const available = new Set(
    (input.availableInputKeys ?? []).map((value) => value.trim()).filter(Boolean),
  )

  const tasks = plan.routines.map((routine) =>
    buildTask({
      family: input.family,
      routine,
      businessDate,
      lastCompletedDate:
        input.lastCompletedDateByRoutine?.[routine.id],
      available,
      funnelStage: input.diagnostic?.funnelStage,
    }),
  )

  const dueTasks = tasks
    .filter((task) => task.due)
    .sort(compareTasks)
  const blockedDueTasks = dueTasks.filter((task) => task.missingInputs.length > 0)

  return Object.freeze({
    family: input.family,
    businessDate,
    tasks: Object.freeze(tasks),
    dueTasks: Object.freeze(dueTasks),
    blockedDueTasks: Object.freeze(blockedDueTasks),
    authority: 'SEARCH_COMMERCE_TASK_QUEUE_ONLY',
    externalActionAuthorized: false,
    publishingAuthorized: false,
    promotionAuthorized: false,
    purchasingAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

function buildTask(input: {
  family: SideHustleFamily
  routine: SearchCommerceRoutine
  businessDate: string
  lastCompletedDate?: string
  available: Set<SearchCommerceEvidenceKey>
  funnelStage?: SearchCommerceFunnelStage
}): SearchCommerceDueTask {
  const lastCompletedDate = input.lastCompletedDate
    ? normalizeBusinessDate(input.lastCompletedDate)
    : undefined

  const due = isDue(input.routine.cadence, input.businessDate, lastCompletedDate)
  const missingInputs = input.routine.requiredInputs.filter(
    (key) => !input.available.has(key),
  )

  return Object.freeze({
    id: [
      'search-commerce-task',
      input.family,
      input.routine.id,
      periodKey(input.routine.cadence, input.businessDate),
    ].join(':'),
    family: input.family,
    routineId: input.routine.id,
    cadence: input.routine.cadence,
    objective: input.routine.objective,
    due,
    priority: taskPriority(input.routine.id, input.funnelStage),
    requiredInputs: input.routine.requiredInputs,
    missingInputs: Object.freeze([...missingInputs]),
    produces: input.routine.produces,
    lastCompletedDate,
    businessDate: input.businessDate,
    periodKey: periodKey(input.routine.cadence, input.businessDate),
    authority: 'SEARCH_COMMERCE_TASK_PLANNING_ONLY',
    externalActionAuthorized: false,
    publishingAuthorized: false,
    promotionAuthorized: false,
    purchasingAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

function isDue(
  cadence: SearchCommerceCadence,
  businessDate: string,
  lastCompletedDate?: string,
): boolean {
  if (!lastCompletedDate) return true
  if (lastCompletedDate > businessDate) {
    throw new Error('Search Commerce routine completion cannot be in the future')
  }

  switch (cadence) {
    case 'daily':
      return lastCompletedDate !== businessDate
    case 'weekly':
      return isoWeekKey(lastCompletedDate) !== isoWeekKey(businessDate)
    case 'monthly':
      return lastCompletedDate.slice(0, 7) !== businessDate.slice(0, 7)
  }
}

function taskPriority(
  routineId: SearchCommerceRoutineId,
  stage?: SearchCommerceFunnelStage,
): SearchCommerceTaskPriority {
  if (!stage || stage === 'evidence_insufficient') {
    return routineId === 'daily_shop_health' ? 'high' : 'normal'
  }

  const high = priorityRoutines(stage)
  return high.has(routineId) ? 'high' : 'normal'
}

function priorityRoutines(
  stage: SearchCommerceFunnelStage,
): ReadonlySet<SearchCommerceRoutineId> {
  switch (stage) {
    case 'no_observed_discovery':
      return new Set([
        'weekly_listing_inventory',
        'weekly_market_research',
        'monthly_operating_plan',
      ])
    case 'impressions_without_visits':
      return new Set([
        'weekly_conversion_experiments',
        'monthly_shop_audit',
      ])
    case 'visits_without_orders':
      return new Set([
        'weekly_conversion_experiments',
        'monthly_shop_audit',
        'monthly_financial_review',
      ])
    case 'orders_observed':
      return new Set([
        'weekly_listing_inventory',
        'weekly_market_research',
        'monthly_financial_review',
      ])
    case 'evidence_insufficient':
      return new Set()
  }
}

function compareTasks(a: SearchCommerceDueTask, b: SearchCommerceDueTask): number {
  const priority = priorityRank(b.priority) - priorityRank(a.priority)
  if (priority !== 0) return priority

  const cadence = cadenceRank(a.cadence) - cadenceRank(b.cadence)
  if (cadence !== 0) return cadence

  return a.routineId.localeCompare(b.routineId)
}

function priorityRank(priority: SearchCommerceTaskPriority): number {
  return priority === 'high' ? 2 : 1
}

function cadenceRank(cadence: SearchCommerceCadence): number {
  switch (cadence) {
    case 'daily':
      return 1
    case 'weekly':
      return 2
    case 'monthly':
      return 3
  }
}

function normalizeBusinessDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Search Commerce businessDate must use YYYY-MM-DD')
  }
  const parsed = Date.parse(value + 'T00:00:00.000Z')
  if (!Number.isFinite(parsed)) {
    throw new Error('Search Commerce businessDate must be a valid calendar date')
  }
  const normalized = new Date(parsed).toISOString().slice(0, 10)
  if (normalized !== value) {
    throw new Error('Search Commerce businessDate must be a valid calendar date')
  }
  return normalized
}

function isoWeekKey(value: string): string {
  const date = new Date(value + 'T00:00:00.000Z')
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(
    (((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7,
  )
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}


export function searchCommercePeriodKey(
  cadence: SearchCommerceCadence,
  businessDate: string,
): string {
  return periodKey(cadence, normalizeBusinessDate(businessDate))
}

function periodKey(cadence: SearchCommerceCadence, businessDate: string): string {
  switch (cadence) {
    case 'daily':
      return businessDate
    case 'weekly':
      return isoWeekKey(businessDate)
    case 'monthly':
      return businessDate.slice(0, 7)
  }
}
