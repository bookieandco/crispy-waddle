import type {
  SubsystemIntelligenceAdapter,
  SubsystemIntelligenceRequest,
  SubsystemIntelligenceResponse,
} from "@jhadina/intelligence-core";
import { createRestorationCase, type RestorationCase } from "./restoration.js";
import {
  MusicPerceptionMemoryStore,
  type MusicPerceptionMemory,
} from "./restoration-engine/music-perception-memory.js";

export interface MusicRestorationCaseIngress {
  register(input: {
    restorationCase: RestorationCase;
    sourceAssetId: string;
    evidenceIds: readonly string[];
    intent?: string;
  }): Promise<{ receiptId: string }>;
}

/**
 * Jhadina universal-intake -> Music Core intelligence bridge.
 *
 * The bridge creates/forwards a source restoration case and immutable
 * source-specific observation memories only. It does not run restoration,
 * separation, reconstruction, mastering, export, or any music ActionHandler.
 */
export class JhadinaMediaIntelligenceAdapter implements SubsystemIntelligenceAdapter {
  readonly subsystem = "jhadina-media" as const;

  constructor(
    private readonly cases: MusicRestorationCaseIngress,
    private readonly perceptionMemory: MusicPerceptionMemoryStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async ingest(input: SubsystemIntelligenceRequest): Promise<SubsystemIntelligenceResponse> {
    if (!input.actorId.trim()) throw new Error("MUSIC_INGRESS_ACTOR_REQUIRED");
    if (!input.assetId.trim()) throw new Error("MUSIC_INGRESS_ASSET_REQUIRED");
    if (!input.evidence.length) throw new Error("MUSIC_INGRESS_EVIDENCE_REQUIRED");

    const evidenceIds = input.evidence.map((evidence) => evidence.id);
    if (evidenceIds.some((id) => !id.startsWith(`asset:${input.assetId}:`))) {
      throw new Error("MUSIC_INGRESS_EVIDENCE_NOT_ASSET_BOUND");
    }

    const createdAt = this.now().toISOString();
    const restorationCase = createRestorationCase({
      id: `music-case:${input.assetId}`,
      userId: input.actorId,
      title: input.intent?.trim() || `Jhadina media intake ${input.assetId}`,
      sourceArtifactId: input.assetId,
      now: createdAt,
    });

    for (const evidence of input.evidence) {
      const memoryId = `music-memory:jllm:${evidence.id}`;
      if (this.perceptionMemory.get(memoryId)) continue;
      const memory: MusicPerceptionMemory = {
        id: memoryId,
        kind: "observation",
        sourceArtifactId: input.assetId,
        createdAt: evidence.observedAt || createdAt,
        statement: evidence.summary,
        evidenceIds: [evidence.id],
        confidence: 1,
        scope: "source-specific",
        approved: true,
        immutableEvidence: true,
      };
      this.perceptionMemory.append(memory);
    }

    const registered = await this.cases.register({
      restorationCase,
      sourceAssetId: input.assetId,
      evidenceIds: Object.freeze([...evidenceIds]),
      intent: input.intent,
    });

    return Object.freeze({
      subsystem: this.subsystem,
      acceptedEvidenceIds: Object.freeze([...evidenceIds]),
      receiptId: registered.receiptId,
    });
  }
}
