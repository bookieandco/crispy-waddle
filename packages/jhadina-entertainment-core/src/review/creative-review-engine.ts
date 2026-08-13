import type { CreativeGraphRepository, CreativeNode } from "../graph/types.js";
import type { ReferenceMatchEngine } from "../reference/reference-match-engine.js";

export interface ReviewSignal {
  feature: string;
  direction: "strength" | "opportunity";
  evidenceIds: string[];
  confidence: number;
}

export interface CreativeReview {
  work: CreativeNode;
  strengths: ReviewSignal[];
  opportunities: ReviewSignal[];
  references: Awaited<ReturnType<ReferenceMatchEngine["findMatches"]>>;
}

export interface CreativeReviewRequest {
  workNodeId: string;
  techniqueIds?: string[];
  limit?: number;
}

export class CreativeReviewEngine {
  constructor(
    private readonly graph: CreativeGraphRepository,
    private readonly referenceMatcher: ReferenceMatchEngine,
  ) {}

  async review(request: CreativeReviewRequest): Promise<CreativeReview> {
    const work = await this.graph.getNode(request.workNodeId);
    if (!work) throw new Error(`Creative work not found: ${request.workNodeId}`);

    const relations = await this.graph.getRelations(work.id);
    const strengths: ReviewSignal[] = [];
    const opportunities: ReviewSignal[] = [];

    for (const relation of relations) {
      const targetId = relation.from === work.id ? relation.to : relation.from;
      const target = await this.graph.getNode(targetId);
      if (!target) continue;

      const signal: ReviewSignal = {
        feature: target.label,
        direction: relation.type === "conflicts_with" ? "opportunity" : "strength",
        evidenceIds: relation.evidenceIds,
        confidence: Math.max(0, Math.min(1, relation.weight ?? 1)),
      };

      (signal.direction === "strength" ? strengths : opportunities).push(signal);
    }

    const references = await this.referenceMatcher.findMatches({
      workNodeId: work.id,
      techniqueIds: request.techniqueIds,
      limit: request.limit ?? 5,
    });

    return { work, strengths, opportunities, references };
  }
}
