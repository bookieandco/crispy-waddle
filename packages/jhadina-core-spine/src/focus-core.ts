export type FocusWorkClass =
  | 'maintenance'
  | 'progress'
  | 'exploration'
  | 'obligation'
  | 'recovery'

export interface FocusWorkItem {
  id: string
  objectiveRef: string
  label: string
  classification: FocusWorkClass
  requiresOwner: boolean
  estimatedHours: number
  progressContribution: number
  dependencyUnlock: number
  urgency: number
  evidenceRefs: readonly string[]
}

export interface FocusAssessment {
  objectiveRef: string
  primaryOwnerItemId?: string
  systemBottleneckItemId?: string
  progressHours: number
  maintenanceHours: number
  maintenanceShare: number
  deferredItemIds: readonly string[]
  evidenceRefs: readonly string[]
  authority: 'PRIORITIZATION_ONLY'
}

export interface FocusInterruptionAssessment {
  currentFocusItemId: string
  candidateItemId: string
  disposition: 'urgent' | 'superseding' | 'additive' | 'distraction'
  reasons: readonly string[]
  authorizationEffect: 'NONE'
}

export function assessFocus(input: {
  objectiveRef: string
  items: readonly FocusWorkItem[]
}): FocusAssessment {
  requireText(input.objectiveRef, 'FOCUS_OBJECTIVE_REQUIRED')
  if (!input.items.length) throw new Error('FOCUS_ITEMS_REQUIRED')

  const items = input.items.map(validateItem)
  const inScope = items.filter((item) => item.objectiveRef === input.objectiveRef)
  if (!inScope.length) throw new Error('FOCUS_OBJECTIVE_HAS_NO_WORK')

  const ownerItems = inScope.filter((item) => item.requiresOwner)
  const primaryOwner = [...ownerItems].sort(compareLeverage)[0]
  const bottleneck = [...inScope].sort(compareLeverage)[0]
  const progressHours = sumHours(inScope.filter((item) => item.classification === 'progress'))
  const maintenanceHours = sumHours(inScope.filter((item) => item.classification === 'maintenance'))
  const totalHours = sumHours(inScope)

  const selected = new Set([primaryOwner?.id, bottleneck?.id].filter((id): id is string => Boolean(id)))
  const deferredItemIds = inScope
    .filter((item) => !selected.has(item.id) && item.classification === 'exploration')
    .map((item) => item.id)

  return Object.freeze({
    objectiveRef: input.objectiveRef,
    primaryOwnerItemId: primaryOwner?.id,
    systemBottleneckItemId: bottleneck?.id,
    progressHours,
    maintenanceHours,
    maintenanceShare: totalHours === 0 ? 0 : round(maintenanceHours / totalHours),
    deferredItemIds: Object.freeze(deferredItemIds),
    evidenceRefs: Object.freeze(unique(inScope.flatMap((item) => item.evidenceRefs))),
    authority: 'PRIORITIZATION_ONLY',
  })
}

export function assessFocusInterruption(input: {
  current: FocusWorkItem
  candidate: FocusWorkItem
  candidateDeadlineMaterial: boolean
  candidateInvalidatesCurrentPlan: boolean
}): FocusInterruptionAssessment {
  const current = validateItem(input.current)
  const candidate = validateItem(input.candidate)
  const reasons: string[] = []

  let disposition: FocusInterruptionAssessment['disposition']
  if (input.candidateDeadlineMaterial || candidate.classification === 'obligation' && candidate.urgency > current.urgency) {
    disposition = 'urgent'
    reasons.push('Candidate has a material deadline or higher-urgency obligation.')
  } else if (input.candidateInvalidatesCurrentPlan) {
    disposition = 'superseding'
    reasons.push('Candidate evidence invalidates the current focus plan.')
  } else if (candidate.objectiveRef === current.objectiveRef && compareLeverage(candidate, current) < 0) {
    disposition = 'superseding'
    reasons.push('Candidate unlocks more of the same objective than the current focus.')
  } else if (candidate.objectiveRef === current.objectiveRef) {
    disposition = 'additive'
    reasons.push('Candidate supports the current objective but does not supersede the focus.')
  } else {
    disposition = 'distraction'
    reasons.push('Candidate does not materially advance the locked objective.')
  }

  return Object.freeze({
    currentFocusItemId: current.id,
    candidateItemId: candidate.id,
    disposition,
    reasons: Object.freeze(reasons),
    authorizationEffect: 'NONE',
  })
}

function compareLeverage(a: FocusWorkItem, b: FocusWorkItem): number {
  if (a.dependencyUnlock !== b.dependencyUnlock) return b.dependencyUnlock - a.dependencyUnlock
  if (a.progressContribution !== b.progressContribution) return b.progressContribution - a.progressContribution
  if (a.urgency !== b.urgency) return b.urgency - a.urgency
  if (a.estimatedHours !== b.estimatedHours) return a.estimatedHours - b.estimatedHours
  return a.id.localeCompare(b.id)
}

function validateItem(item: FocusWorkItem): FocusWorkItem {
  requireText(item.id, 'FOCUS_ITEM_ID_REQUIRED')
  requireText(item.objectiveRef, 'FOCUS_ITEM_OBJECTIVE_REQUIRED')
  requireText(item.label, 'FOCUS_ITEM_LABEL_REQUIRED')
  if (!Number.isFinite(item.estimatedHours) || item.estimatedHours < 0) throw new Error('FOCUS_ITEM_HOURS_INVALID')
  for (const [field, value] of [
    ['progressContribution', item.progressContribution],
    ['dependencyUnlock', item.dependencyUnlock],
    ['urgency', item.urgency],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`FOCUS_ITEM_${field.toUpperCase()}_INVALID`)
  }
  if (!item.evidenceRefs.length || item.evidenceRefs.some((ref) => !ref.trim())) {
    throw new Error('FOCUS_ITEM_EVIDENCE_REQUIRED')
  }
  return Object.freeze({ ...item, evidenceRefs: Object.freeze(unique(item.evidenceRefs)) })
}

function sumHours(items: readonly FocusWorkItem[]): number {
  return round(items.reduce((sum, item) => sum + item.estimatedHours, 0))
}

function requireText(value: string, code: string): void {
  if (!value?.trim()) throw new Error(code)
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000
}
