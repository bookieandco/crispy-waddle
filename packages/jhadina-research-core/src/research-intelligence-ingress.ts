import type {
  SubsystemIntelligenceAdapter,
  SubsystemIntelligenceRequest,
  SubsystemIntelligenceResponse,
} from "@jhadina/intelligence-core";
import type { ResearchQueue } from "./research-queue.js";
import { validateResearchQueue } from "./research-queue.js";

export interface ResearchQueueIngress {
  enqueue(queue: ResearchQueue): Promise<{ receiptId: string }>;
}

export class JhadinaResearchIntelligenceAdapter implements SubsystemIntelligenceAdapter {
  readonly subsystem = "research" as const;
  constructor(private readonly ingress: ResearchQueueIngress) {}

  async ingest(input: SubsystemIntelligenceRequest): Promise<SubsystemIntelligenceResponse> {
    if (!input.evidence.length) throw new Error("RESEARCH_INGRESS_EVIDENCE_REQUIRED");
    const evidenceIds = input.evidence.map((evidence) => evidence.id);
    if (evidenceIds.some((id) => !id.startsWith(`asset:${input.assetId}:`))) {
      throw new Error("RESEARCH_INGRESS_EVIDENCE_NOT_ASSET_BOUND");
    }
    const queue: ResearchQueue = {
      id: `research:intake:${input.assetId}`,
      objective: input.intent?.trim() || `Analyze uploaded asset ${input.assetId}`,
      revision: 0,
      budget: { maxCost: 1, maxRisk: 1, spentCost: 0, accruedRisk: 0 },
      tasks: [{
        id: `research-task:intake:${input.assetId}`,
        objective: input.intent?.trim() || "Analyze source evidence without taking external action",
        dependencies: [], priority: 1, expectedValue: 1, cost: 0, risk: 0,
        authorizationClass: "analysis", state: "ready", evidenceIds,
      }],
    };
    validateResearchQueue(queue);
    const accepted = await this.ingress.enqueue(queue);
    return Object.freeze({subsystem:this.subsystem,acceptedEvidenceIds:Object.freeze([...evidenceIds]),receiptId:accepted.receiptId});
  }
}
