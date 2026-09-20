import type {
  SubsystemIntelligenceAdapter,
  SubsystemIntelligenceRequest,
  SubsystemIntelligenceResponse,
} from "@jhadina/intelligence-core";
import type { KnowledgeGraph } from "./index.js";

export class KnowledgeGraphIntelligenceAdapter implements SubsystemIntelligenceAdapter {
  readonly subsystem = "knowledge" as const;
  constructor(private readonly graph: KnowledgeGraph) {}

  async ingest(input: SubsystemIntelligenceRequest): Promise<SubsystemIntelligenceResponse> {
    if (!input.evidence.length) throw new Error("KNOWLEDGE_INGRESS_EVIDENCE_REQUIRED");
    const assetNodeId = `asset:${input.assetId}`;
    this.graph.registerNode({
      nodeId: assetNodeId,
      nodeType: "intelligence-asset",
      label: input.intent?.trim() || input.assetId,
      attributes: { mediaType: input.mediaType ?? null, privacyClass: input.privacyClass ?? null },
      provenanceRefs: input.evidence.map((evidence) => evidence.id),
    });
    for (const evidence of input.evidence) {
      if (!evidence.id.startsWith(`asset:${input.assetId}:`)) throw new Error("KNOWLEDGE_INGRESS_EVIDENCE_NOT_ASSET_BOUND");
      const evidenceNodeId = `evidence:${evidence.id}`;
      this.graph.registerNode({
        nodeId: evidenceNodeId, nodeType: "evidence", label: evidence.summary,
        attributes: { source: evidence.source, observedAt: evidence.observedAt },
        provenanceRefs: [evidence.id],
      });
      this.graph.registerRelation({
        relationId: `derived-from:${evidenceNodeId}:${assetNodeId}`,
        fromNodeId: evidenceNodeId, toNodeId: assetNodeId,
        relationType: "derived-from", provenanceRefs: [evidence.id],
      });
    }
    return Object.freeze({
      subsystem:this.subsystem,
      acceptedEvidenceIds:Object.freeze(input.evidence.map((evidence)=>evidence.id)),
      receiptId:`knowledge:${input.assetId}`,
    });
  }
}
