import type { EphemeralArtifactContext, WorkSessionRepository } from "@jhadina/core-spine"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CleanArtifactContextResolver } from "./clean-artifact-context-resolver"
import { SupabaseWorkSessionRepository } from "../work-session/supabase-work-session-repository"

const MAX_RESUMED_ARTIFACTS = 8

export interface WorkSessionArtifactResumeInput {
  client: SupabaseClient
  ownerUserId: string
  workSessionId: string
  excludeArtifactIds?: readonly string[]
  maxArtifacts?: number
}

export interface WorkSessionArtifactResumeResult {
  artifacts: EphemeralArtifactContext[]
  attemptedArtifactIds: string[]
  unavailableArtifactIds: string[]
}

/**
 * Rehydrates durable artifact content referenced by a WorkSession.
 *
 * The WorkSession admitted bit is only a candidate signal. Every artifact
 * is re-read through CleanArtifactContextResolver, which rechecks owner scope,
 * current clean status, representation availability, and size limits before
 * any bytes/text can become model context.
 *
 * Session artifacts are best-effort continuity: a stale/deleted ref never
 * blocks an otherwise valid Ask turn. Explicit artifact refs keep their
 * existing strict fail-closed behavior in the command route.
 */
export async function resolveWorkSessionArtifactContext(
  input: WorkSessionArtifactResumeInput,
  overrides: {
    repository?: WorkSessionRepository
    resolver?: Pick<CleanArtifactContextResolver, "resolve">
  } = {},
): Promise<WorkSessionArtifactResumeResult> {
  const workSessionId = input.workSessionId.trim().slice(0, 200)
  if (!workSessionId) {
    return { artifacts: [], attemptedArtifactIds: [], unavailableArtifactIds: [] }
  }

  const repository = overrides.repository
    ?? new SupabaseWorkSessionRepository(input.client, input.ownerUserId)
  const session = await repository.get(workSessionId)
  if (!session || session.ownerUserId !== input.ownerUserId) {
    return { artifacts: [], attemptedArtifactIds: [], unavailableArtifactIds: [] }
  }

  const excluded = new Set(input.excludeArtifactIds ?? [])
  const maxArtifacts = Math.max(
    0,
    Math.min(MAX_RESUMED_ARTIFACTS, input.maxArtifacts ?? MAX_RESUMED_ARTIFACTS),
  )
  const ids = [...new Set(
    session.artifactRefs
      .filter((ref) => ref.admitted && !excluded.has(ref.id))
      .map((ref) => ref.id)
      .filter(Boolean),
  )].slice(0, maxArtifacts)

  const resolver = overrides.resolver
    ?? new CleanArtifactContextResolver(input.client, input.ownerUserId)
  const artifacts: EphemeralArtifactContext[] = []
  const unavailableArtifactIds: string[] = []

  for (const id of ids) {
    try {
      const resolved = await resolver.resolve([{ id }])
      const artifact = resolved[0]
      if (artifact) artifacts.push(artifact)
      else unavailableArtifactIds.push(id)
    } catch {
      unavailableArtifactIds.push(id)
    }
  }

  return {
    artifacts,
    attemptedArtifactIds: ids,
    unavailableArtifactIds,
  }
}
