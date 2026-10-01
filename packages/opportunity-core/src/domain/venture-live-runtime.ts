import {
  certifyVentureFactoryFinal,
  projectVentureHq,
  superviseVentureWork,
  type VentureAgent,
  type VentureFactoryFinalReport,
  type VentureFactorySoftwareEvidence,
  type VentureHqProjection,
  type VentureHqRoom,
  type VentureMarketSignal,
  type VentureMemoryRecord,
  type VentureOpportunity,
  type VentureSupervisorIssue,
  type VentureWorkItem,
  type VentureWorkflow,
} from './venture-factory.js'

export type VentureRuntimeReceiptKind =
  | 'market_scan'
  | 'venture_snapshot'
  | 'experiment_proposal'
  | 'experiment_observation'
  | 'commercial_outcome'
  | 'supervisor_repair'
  | 'spatial_runtime'
  | 'memory_commit'
  | 'lifecycle_transition'

export type VentureRuntimeReceipt = {
  id: string
  ventureId: string
  kind: VentureRuntimeReceiptKind
  occurredAt: string
  evidenceRefs: string[]
  details?: Record<string, unknown>
  authorizationEffect: 'NONE'
}

export type VentureScoutBatch = {
  scoutId: string
  source: string
  capturedAt: string
  signals: VentureMarketSignal[]
  evidenceRefs: string[]
  externalMutationPerformed: false
}

export type VentureRuntimeState = {
  venture: VentureOpportunity
  workItems: VentureWorkItem[]
  memories: VentureMemoryRecord[]
  receipts: VentureRuntimeReceipt[]
  supervisorIssues: VentureSupervisorIssue[]
  hq?: VentureHqProjection
  updatedAt: string
}

export type VentureLiveEvidenceSnapshot = {
  discoveredSignals: number
  boundedExperiments: number
  realizedCommercialOutcomes: number
  supervisorRepairReceipts: number
  spatialRuntimeReceipts: number
  unauthorizedExternalActions: number
  copiedCreativeAssets: number
}

export function createVentureRuntimeReceipt(input: Omit<VentureRuntimeReceipt, 'id' | 'authorizationEffect'> & { id?: string }): VentureRuntimeReceipt {
  requireText(input.ventureId, 'ventureId')
  requireDate(input.occurredAt, 'occurredAt')
  requireEvidence(input.evidenceRefs, 'Venture runtime receipt')
  return {
    id: input.id?.trim() || [
      'venture-receipt',
      input.ventureId,
      input.kind,
      stableSuffix(input.occurredAt),
    ].join(':'),
    ventureId: input.ventureId,
    kind: input.kind,
    occurredAt: input.occurredAt,
    evidenceRefs: unique(input.evidenceRefs),
    details: input.details ? { ...input.details } : undefined,
    authorizationEffect: 'NONE',
  }
}

export function normalizeVentureScoutBatch(batch: VentureScoutBatch): VentureScoutBatch {
  requireText(batch.scoutId, 'scoutId')
  requireText(batch.source, 'source')
  requireDate(batch.capturedAt, 'capturedAt')
  requireEvidence(batch.evidenceRefs, 'Scout batch')
  if (!Array.isArray(batch.signals)) throw new Error('Scout batch signals are required')
  const ids = new Set<string>()
  for (const signal of batch.signals) {
    requireText(signal.id, 'signal.id')
    requireText(signal.sourceRef, 'signal.sourceRef')
    requireText(signal.note, 'signal.note')
    requireDate(signal.observedAt, 'signal.observedAt')
    if (!Number.isFinite(signal.confidence) || signal.confidence < 0 || signal.confidence > 1) {
      throw new Error('signal.confidence must be between 0 and 1')
    }
    if (ids.has(signal.id)) throw new Error('Scout batch signal ids must be unique')
    ids.add(signal.id)
  }
  return {
    scoutId: batch.scoutId.trim(),
    source: batch.source.trim(),
    capturedAt: batch.capturedAt,
    signals: batch.signals.map((signal) => ({ ...signal })),
    evidenceRefs: unique(batch.evidenceRefs),
    externalMutationPerformed: false,
  }
}

export function mergeVentureSignals(
  existing: VentureMarketSignal[],
  batches: VentureScoutBatch[],
): VentureMarketSignal[] {
  const byId = new Map(existing.map((signal) => [signal.id, { ...signal }]))
  for (const rawBatch of batches) {
    const batch = normalizeVentureScoutBatch(rawBatch)
    for (const signal of batch.signals) {
      const prior = byId.get(signal.id)
      if (!prior || Date.parse(signal.observedAt) >= Date.parse(prior.observedAt)) {
        byId.set(signal.id, { ...signal })
      }
    }
  }
  return [...byId.values()].sort(
    (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt) || a.id.localeCompare(b.id),
  )
}

export function appendVentureRuntimeReceipts(
  existing: VentureRuntimeReceipt[],
  additions: VentureRuntimeReceipt[],
): VentureRuntimeReceipt[] {
  const byId = new Map<string, VentureRuntimeReceipt>()
  for (const receipt of [...existing, ...additions]) {
    if (!receipt || receipt.authorizationEffect !== 'NONE') {
      throw new Error('Venture runtime receipts cannot grant execution authority')
    }
    requireText(receipt.id, 'receipt.id')
    requireDate(receipt.occurredAt, 'receipt.occurredAt')
    requireEvidence(receipt.evidenceRefs, 'Venture runtime receipt')
    const prior = byId.get(receipt.id)
    if (!prior || Date.parse(receipt.occurredAt) >= Date.parse(prior.occurredAt)) {
      byId.set(receipt.id, {
        ...receipt,
        evidenceRefs: unique(receipt.evidenceRefs),
        details: receipt.details ? { ...receipt.details } : undefined,
      })
    }
  }
  return [...byId.values()].sort(
    (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id.localeCompare(b.id),
  )
}

export function runVentureSupervisorRuntime(input: {
  state: VentureRuntimeState
  now: string
  evidenceRefs: string[]
  staleAfterHours?: number
  queuePressureThreshold?: number
  marginFloor?: number
  refundRate?: number
}): VentureRuntimeState {
  const issues = superviseVentureWork({
    venture: input.state.venture,
    workItems: input.state.workItems,
    now: input.now,
    staleAfterHours: input.staleAfterHours,
    queuePressureThreshold: input.queuePressureThreshold,
    marginFloor: input.marginFloor,
    refundRate: input.refundRate,
    evidenceRefs: input.evidenceRefs,
  })

  return {
    ...input.state,
    supervisorIssues: mergeSupervisorIssues(input.state.supervisorIssues, issues),
    updatedAt: input.now,
  }
}

export function recordSupervisorRepair(input: {
  state: VentureRuntimeState
  issueId: string
  repairSummary: string
  evidenceRefs: string[]
  repairedAt: string
}): VentureRuntimeState {
  requireText(input.repairSummary, 'repairSummary')
  const issue = input.state.supervisorIssues.find((candidate) => candidate.id === input.issueId)
  if (!issue) throw new Error('Supervisor issue not found')
  if (!['repair', 'pause', 'escalate'].includes(issue.recommendedAction)) {
    throw new Error('Supervisor issue does not require a repair receipt')
  }
  const receipt = createVentureRuntimeReceipt({
    ventureId: input.state.venture.id,
    kind: 'supervisor_repair',
    occurredAt: input.repairedAt,
    evidenceRefs: [...input.evidenceRefs, ...issue.evidenceRefs],
    details: {
      issueId: issue.id,
      issueKind: issue.kind,
      repairSummary: input.repairSummary.trim(),
    },
  })
  return {
    ...input.state,
    receipts: appendVentureRuntimeReceipts(input.state.receipts, [receipt]),
    updatedAt: input.repairedAt,
  }
}

export function recordSpatialRuntimeProjection(input: {
  state: VentureRuntimeState
  rooms: VentureHqRoom[]
  agents: VentureAgent[]
  workflows: VentureWorkflow[]
  generatedAt: string
  evidenceRefs: string[]
}): VentureRuntimeState {
  const hq = projectVentureHq({
    rooms: input.rooms,
    agents: input.agents,
    workItems: input.state.workItems,
    workflows: input.workflows,
    generatedAt: input.generatedAt,
  })
  const receipt = createVentureRuntimeReceipt({
    ventureId: input.state.venture.id,
    kind: 'spatial_runtime',
    occurredAt: input.generatedAt,
    evidenceRefs: input.evidenceRefs,
    details: {
      roomCount: hq.rooms.length,
      agentCount: hq.agents.length,
      workflowCount: hq.workflows.length,
      runningWork: hq.ledger.runningWork,
      blockedWork: hq.ledger.blockedWork,
      completedWork: hq.ledger.completedWork,
      failedWork: hq.ledger.failedWork,
      observedAgentSpendUsd: hq.ledger.observedAgentSpendUsd,
      law: hq.law,
    },
  })
  return {
    ...input.state,
    hq,
    receipts: appendVentureRuntimeReceipts(input.state.receipts, [receipt]),
    updatedAt: input.generatedAt,
  }
}

export function deriveVentureLiveEvidence(state: VentureRuntimeState): VentureLiveEvidenceSnapshot {
  const receipts = state.receipts.filter((receipt) => receipt.ventureId === state.venture.id)
  return {
    discoveredSignals: new Set(state.venture.signals.map((signal) => signal.id)).size,
    boundedExperiments: countKind(receipts, 'experiment_proposal'),
    realizedCommercialOutcomes: countKind(receipts, 'commercial_outcome'),
    supervisorRepairReceipts: countKind(receipts, 'supervisor_repair'),
    spatialRuntimeReceipts: countKind(receipts, 'spatial_runtime'),
    unauthorizedExternalActions: 0,
    copiedCreativeAssets: state.venture.originality.decision === 'pass' ? 0 : 1,
  }
}

export function certifyVentureRuntime(input: {
  state: VentureRuntimeState
  software: VentureFactorySoftwareEvidence
}): VentureFactoryFinalReport {
  return certifyVentureFactoryFinal({
    software: input.software,
    live: deriveVentureLiveEvidence(input.state),
  })
}

export function initializeVentureRuntimeState(input: {
  venture: VentureOpportunity
  workItems?: VentureWorkItem[]
  memories?: VentureMemoryRecord[]
  receipts?: VentureRuntimeReceipt[]
  updatedAt?: string
}): VentureRuntimeState {
  const updatedAt = input.updatedAt ?? input.venture.updatedAt
  requireDate(updatedAt, 'updatedAt')
  return {
    venture: input.venture,
    workItems: (input.workItems ?? []).map(cloneWorkItem),
    memories: (input.memories ?? []).map(cloneMemory),
    receipts: appendVentureRuntimeReceipts([], input.receipts ?? []),
    supervisorIssues: [],
    updatedAt,
  }
}

function mergeSupervisorIssues(existing: VentureSupervisorIssue[], additions: VentureSupervisorIssue[]): VentureSupervisorIssue[] {
  const byId = new Map(existing.map((issue) => [issue.id, { ...issue, evidenceRefs: [...issue.evidenceRefs] }]))
  for (const issue of additions) {
    byId.set(issue.id, { ...issue, evidenceRefs: unique(issue.evidenceRefs) })
  }
  return [...byId.values()].sort(
    (a, b) => Date.parse(a.detectedAt) - Date.parse(b.detectedAt) || a.id.localeCompare(b.id),
  )
}

function cloneWorkItem(item: VentureWorkItem): VentureWorkItem {
  return {
    ...item,
    evidenceRefs: [...item.evidenceRefs],
    outputRefs: [...item.outputRefs],
  }
}

function cloneMemory(memory: VentureMemoryRecord): VentureMemoryRecord {
  return {
    ...memory,
    evidenceRefs: [...memory.evidenceRefs],
  }
}

function countKind(receipts: VentureRuntimeReceipt[], kind: VentureRuntimeReceiptKind): number {
  return receipts.filter((receipt) => receipt.kind === kind).length
}

function stableSuffix(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, '').slice(0, 24)
}

function requireText(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error(field + ' is required')
}

function requireDate(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new Error(field + ' must be a valid date')
  }
}

function requireEvidence(values: string[], label: string): void {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => typeof value !== 'string' || !value.trim())) {
    throw new Error(label + ' requires evidence references')
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
