export type SharkContinuityTransitionAudit = Readonly<{
  eventId: string
  fromContextId: string | null
  toContextId: string
  fromVersion: number
  toVersion: number
  addedExperienceIds: readonly string[]
  retainedExperienceIds: readonly string[]
  addedBeliefVersionIds: readonly string[]
  retainedBeliefVersionIds: readonly string[]
  addedContradictionIds: readonly string[]
  retainedContradictionIds: readonly string[]
  occurredAt: string
}>

function added(next: readonly string[], previous: readonly string[]): string[] {
  const old = new Set(previous)
  return next.filter(id => !old.has(id))
}

function retained(next: readonly string[], previous: readonly string[]): string[] {
  const old = new Set(previous)
  return next.filter(id => old.has(id))
}

export function createSharkContinuityTransitionAudit(input: {
  eventId: string
  previous: {
    contextId: string
    version: number
    experienceIds: readonly string[]
    beliefVersionIds: readonly string[]
    unresolvedContradictionIds: readonly string[]
  } | null
  next: {
    contextId: string
    version: number
    experienceIds: readonly string[]
    beliefVersionIds: readonly string[]
    unresolvedContradictionIds: readonly string[]
  }
  occurredAt: string
}): SharkContinuityTransitionAudit {
  if (!input.eventId.trim() || !input.next.contextId.trim() || !input.occurredAt.trim()) throw new Error('audit identity and timestamp are required')
  if (!Number.isInteger(input.next.version) || input.next.version < 1) throw new Error('next version must be positive')
  if (input.previous && input.next.version <= input.previous.version) throw new Error('continuity version must advance')

  const p = input.previous
  return Object.freeze({
    eventId: input.eventId,
    fromContextId: p?.contextId ?? null,
    toContextId: input.next.contextId,
    fromVersion: p?.version ?? 0,
    toVersion: input.next.version,
    addedExperienceIds: Object.freeze(added(input.next.experienceIds, p?.experienceIds ?? [])),
    retainedExperienceIds: Object.freeze(retained(input.next.experienceIds, p?.experienceIds ?? [])),
    addedBeliefVersionIds: Object.freeze(added(input.next.beliefVersionIds, p?.beliefVersionIds ?? [])),
    retainedBeliefVersionIds: Object.freeze(retained(input.next.beliefVersionIds, p?.beliefVersionIds ?? [])),
    addedContradictionIds: Object.freeze(added(input.next.unresolvedContradictionIds, p?.unresolvedContradictionIds ?? [])),
    retainedContradictionIds: Object.freeze(retained(input.next.unresolvedContradictionIds, p?.unresolvedContradictionIds ?? [])),
    occurredAt: input.occurredAt,
  })
}
