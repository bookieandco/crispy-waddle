import type { SupabaseClient } from "@supabase/supabase-js";
import {
  separateRestorationSource,
  type StoredRestorationArtifact,
} from "@jhadina/music-core";
import { SupabaseMusicRestorationArtifactStore } from "./restoration-supabase-store";
import { createMusicRestorationRuntimeClient } from "./restoration-runtime-server";

export interface PersistedSeparationSummary {
  jobId: string;
  runtimeReceiptId: string;
  confidence: number;
  maxDepth: number;
  artifacts: StoredRestorationArtifact[];
}

export async function runPersistedSeparation(input: {
  client: SupabaseClient;
  ownerUserId: string;
  caseId: string;
  source: StoredRestorationArtifact;
  modelId?: string;
}): Promise<PersistedSeparationSummary> {
  const store = new SupabaseMusicRestorationArtifactStore(input.client, input.ownerUserId);
  const jobId = `music-separate:${globalThis.crypto.randomUUID()}`;
  await store.createJob({
    id: jobId,
    caseId: input.caseId,
    kind: "separate",
    sourceArtifactId: input.source.id,
    metadata: { modelId: input.modelId ?? null },
  });

  try {
    const result = await separateRestorationSource({
      ownerUserId: input.ownerUserId,
      caseId: input.caseId,
      source: input.source,
      runtime: input.runtime,
      store,
      jobId,
      modelId: input.modelId,
    });
    await store.completeJob({
      id: jobId,
      outputArtifactIds: result.artifacts.map(artifact => artifact.id),
      runtimeReceiptId: result.runtimeReceiptId,
      metadata: {
        confidence: result.decomposition.confidence,
        maxDepth: result.decomposition.maxDepth,
        nodeCount: result.decomposition.nodes.length,
      },
    });
    return {
      jobId,
      runtimeReceiptId: result.runtimeReceiptId,
      confidence: result.decomposition.confidence,
      maxDepth: result.decomposition.maxDepth,
      artifacts: result.artifacts,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Music separation failed";
    await store.failJob(jobId, message);
    throw error;
  }
}
