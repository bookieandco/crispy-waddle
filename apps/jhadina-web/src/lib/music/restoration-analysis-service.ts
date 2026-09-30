import type { SupabaseClient } from "@supabase/supabase-js";
import type { RestorationRuntimeClient } from "@jhadina/music-core";
import { SupabaseMusicRestorationArtifactStore } from "./restoration-supabase-store";
import { runPersistedPerception, type PersistedPerceptionSummary } from "./restoration-perception-service";
import { runPersistedSeparation } from "./restoration-separation-service";

export interface RestorationAnalysisSummary {
  source: PersistedPerceptionSummary;
  separation: null | {
    jobId: string;
    runtimeReceiptId: string;
    confidence: number;
    maxDepth: number;
    artifacts: Array<{
      id: string;
      role?: string;
      sha256: string;
      sampleRate: number;
      channels: number;
      sampleCount: number;
    }>;
  };
  stemPerception: PersistedPerceptionSummary[];
}

export async function analyzeRestorationArtifact(input: {
  client: SupabaseClient;
  ownerUserId: string;
  caseId: string;
  artifactId: string;
  separate?: boolean;
  modelId?: string;
  runtime: RestorationRuntimeClient;
}): Promise<RestorationAnalysisSummary> {
  const store = new SupabaseMusicRestorationArtifactStore(input.client, input.ownerUserId);
  const artifact = await store.get(input.ownerUserId, input.artifactId);
  if (!artifact || artifact.caseId !== input.caseId) {
    throw new Error("MUSIC_RESTORATION_ARTIFACT_NOT_FOUND");
  }

  const source = await runPersistedPerception({
    client: input.client,
    ownerUserId: input.ownerUserId,
    caseId: input.caseId,
    artifact,
    runtime: input.runtime,
  });

  if (input.separate === false) {
    return { source, separation: null, stemPerception: [] };
  }

  const separated = await runPersistedSeparation({
    client: input.client,
    ownerUserId: input.ownerUserId,
    caseId: input.caseId,
    source: artifact,
    modelId: input.modelId,
    runtime: input.runtime,
  });

  const stemPerception: PersistedPerceptionSummary[] = [];
  for (const stem of separated.artifacts) {
    stemPerception.push(await runPersistedPerception({
      client: input.client,
      ownerUserId: input.ownerUserId,
      caseId: input.caseId,
      artifact: stem,
      runtime: input.runtime,
    }));
  }

  return {
    source,
    separation: {
      jobId: separated.jobId,
      runtimeReceiptId: separated.runtimeReceiptId,
      confidence: separated.confidence,
      maxDepth: separated.maxDepth,
      artifacts: separated.artifacts.map(stem => ({
        id: stem.id,
        role: stem.role,
        sha256: stem.contentHash,
        sampleRate: stem.sampleRate,
        channels: stem.channels,
        sampleCount: stem.sampleCount,
      })),
    },
    stemPerception,
  };
}
