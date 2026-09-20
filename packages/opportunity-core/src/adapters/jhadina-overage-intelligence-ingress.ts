import type {
  SubsystemIntelligenceAdapter,
  SubsystemIntelligenceRequest,
  SubsystemIntelligenceResponse,
} from "@jhadina/intelligence-core";

export interface OverageOsDocumentIngress {
  registerSourceDocument(input: {
    actorId: string;
    assetId: string;
    assetRef: string;
    mediaType: string;
    contentSha256?: string;
    evidenceIds: readonly string[];
    observedAt: string;
    intent?: string;
  }): Promise<{ receiptId: string; acceptedEvidenceIds: readonly string[] }>;
}

/**
 * Document-intelligence bridge only. Uploads are admitted to OverageOS as
 * source material, never directly as verified opportunities or claimant facts.
 */
export class OverageOsIntelligenceAdapter implements SubsystemIntelligenceAdapter {
  readonly subsystem = "overageos" as const;

  constructor(private readonly ingress: OverageOsDocumentIngress) {}

  async ingest(input: SubsystemIntelligenceRequest): Promise<SubsystemIntelligenceResponse> {
    if (!input.assetRef) throw new Error("OVERAGE_INGRESS_ASSET_REFERENCE_REQUIRED");
    if (!input.mediaType) throw new Error("OVERAGE_INGRESS_MEDIA_TYPE_REQUIRED");
    if (!input.evidence.length) throw new Error("OVERAGE_INGRESS_EVIDENCE_REQUIRED");
    const allowed = new Set(input.evidence.map((evidence) => evidence.id));
    const observedAt = input.evidence[0]?.observedAt ?? new Date().toISOString();
    const result = await this.ingress.registerSourceDocument({
      actorId: input.actorId,
      assetId: input.assetId,
      assetRef: input.assetRef,
      mediaType: input.mediaType,
      contentSha256: input.contentSha256,
      evidenceIds: Object.freeze([...allowed]),
      observedAt,
      intent: input.intent,
    });
    if (result.acceptedEvidenceIds.some((id) => !allowed.has(id))) {
      throw new Error("OVERAGE_INGRESS_EVIDENCE_NOT_ASSET_BOUND");
    }
    return Object.freeze({
      subsystem: this.subsystem,
      acceptedEvidenceIds: Object.freeze([...result.acceptedEvidenceIds]),
      receiptId: result.receiptId,
    });
  }
}
