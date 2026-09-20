import {
  recoverSamPursuitSnapshot,
  saveSamPursuitSnapshot,
  type SamPursuitSnapshot,
  type SamPursuitSnapshotEnvelope,
  type SamPursuitSnapshotRepository,
} from "@jhadina/opportunity-core"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createSupabaseSamPursuitSnapshotRepository } from "./supabase-sam-pursuit-snapshot-repository"

export async function loadSamPursuitSnapshot(
  repository: SamPursuitSnapshotRepository,
  opportunityId: string,
): Promise<SamPursuitSnapshot | null> {
  const envelope = await repository.load(opportunityId)
  return envelope ? recoverSamPursuitSnapshot(envelope) : null
}

export async function persistSamPursuitSnapshot(
  repository: SamPursuitSnapshotRepository,
  envelope: SamPursuitSnapshotEnvelope,
  expectedRevision: number | null,
): Promise<SamPursuitSnapshot> {
  await saveSamPursuitSnapshot(repository, envelope, expectedRevision)
  return recoverSamPursuitSnapshot(envelope)
}

export async function loadSessionSamPursuitSnapshot(
  opportunityId: string,
): Promise<SamPursuitSnapshot | null> {
  const identityVerifier = await createRequestIdentityVerifier()
  const identity = await identityVerifier.verify({})
  return loadSamPursuitSnapshot(
    createSupabaseSamPursuitSnapshotRepository(identity.userId),
    opportunityId,
  )
}

export async function persistSessionSamPursuitSnapshot(
  envelope: SamPursuitSnapshotEnvelope,
  expectedRevision: number | null,
): Promise<SamPursuitSnapshot> {
  const identityVerifier = await createRequestIdentityVerifier()
  const identity = await identityVerifier.verify({})
  return persistSamPursuitSnapshot(
    createSupabaseSamPursuitSnapshotRepository(identity.userId),
    envelope,
    expectedRevision,
  )
}
