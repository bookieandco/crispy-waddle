export type SharkLongitudinalContext = Readonly<{
  contextId: string
  version: number
  parentContextId: string | null
  experienceIds: readonly string[]
  beliefVersionIds: readonly string[]
  unresolvedContradictionIds: readonly string[]
  updatedAt: string
}>

export function updateSharkLongitudinalContext(input: {
  current: SharkLongitudinalContext | null
  contextId: string
  experienceIds: readonly string[]
  beliefVersionIds: readonly string[]
  unresolvedContradictionIds: readonly string[]
  updatedAt: string
}): SharkLongitudinalContext {
  if (!input.contextId.trim() || !input.updatedAt.trim()) throw new Error('context identity and timestamp are required')
  if (input.current && input.updatedAt < input.current.updatedAt) throw new Error('stale continuity update rejected')
  const version = (input.current?.version ?? 0) + 1
  return Object.freeze({
    contextId: input.contextId,
    version,
    parentContextId: input.current?.contextId ?? null,
    experienceIds: Object.freeze([...new Set(input.experienceIds)]),
    beliefVersionIds: Object.freeze([...new Set(input.beliefVersionIds)]),
    unresolvedContradictionIds: Object.freeze([...new Set(input.unresolvedContradictionIds)]),
    updatedAt: input.updatedAt,
  })
}
