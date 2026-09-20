import {
  recoverSamPursuitSnapshot,
  saveSamPursuitSnapshot,
  type SamPursuitSnapshot,
  type SamPursuitSnapshotEnvelope,
  type SamPursuitSnapshotRepository,
} from "@jhadina/opportunity-core"
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
  return loadSamPursuitSnapshot(createSupabaseSamPursuitSnapshotRepository(), opportunityId)
}

export async function persistSessionSamPursuitSnapshot(
  envelope: SamPursuitSnapshotEnvelope,
  expectedRevision: number | null,
): Promise<SamPursuitSnapshot> {
  return persistSamPursuitSnapshot(
    createSupabaseSamPursuitSnapshotRepository(),
    envelope,
    expectedRevision,
  )
}
