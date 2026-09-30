import type { SupabaseClient } from "@supabase/supabase-js";
import {
  searchAndPersistInstrumentDonors,
  type InstrumentDonorEventKind,
  type InstrumentDonorFamily,
} from "@jhadina/music-core";
import { createMusicRestorationRuntimeClient } from "./restoration-runtime-server";
import { SupabaseMusicRestorationArtifactStore } from "./restoration-supabase-store";

export async function runInstrumentDonorSearch(input: {
  client: SupabaseClient;
  ownerUserId: string;
  caseId: string;
  sourceArtifactId: string;
  instrumentFamily: InstrumentDonorFamily;
  eventKind?: InstrumentDonorEventKind;
  targetStartMs: number;
  targetEndMs: number;
  maxCandidates?: number;
}) {
  const store = new SupabaseMusicRestorationArtifactStore(input.client, input.ownerUserId);
  const source = await store.get(input.ownerUserId, input.sourceArtifactId);
  if (!source || source.caseId !== input.caseId) {
    throw new Error("MUSIC_DONOR_SEARCH_SOURCE_NOT_FOUND");
  }

  const jobId = `music-donor-search:${globalThis.crypto.randomUUID()}`;
  const search = {
    sourceArtifactId: source.id,
    instrumentFamily: input.instrumentFamily,
    eventKind: input.eventKind,
    target: {
      startMs: input.targetStartMs,
      endMs: input.targetEndMs,
    },
    maxCandidates: input.maxCandidates ?? 3,
  } as const;

  await store.createJob({
    id: jobId,
    caseId: input.caseId,
    kind: "donor-search",
    sourceArtifactId: source.id,
    metadata: {
      instrumentFamily: input.instrumentFamily,
      eventKind: input.eventKind ?? null,
      target: search.target,
      maxCandidates: search.maxCandidates,
      authority: "EVIDENCE_ONLY",
    },
  });

  try {
    const result = await searchAndPersistInstrumentDonors({
      ownerUserId: input.ownerUserId,
      caseId: input.caseId,
      source,
      search,
      runtime: createMusicRestorationRuntimeClient(),
      store,
      jobId,
    });
    await store.persistDonorSearchOutcome({
      caseId: input.caseId,
      jobId,
      search,
      result,
    });
    await store.completeJob({
      id: jobId,
      outputArtifactIds: result.candidates.map(candidate => candidate.artifactId),
      runtimeReceiptId: result.runtimeReceiptId,
      metadata: {
        instrumentFamily: input.instrumentFamily,
        eventKind: input.eventKind ?? null,
        target: search.target,
        candidateCount: result.candidates.length,
        authority: "EVIDENCE_ONLY",
      },
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Instrument donor search failed";
    await store.failJob(jobId, message);
    throw error;
  }
}
