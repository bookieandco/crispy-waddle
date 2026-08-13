import type { CreativeGraphRepository, CreativeNode } from "../graph/types.js";

export interface ReferenceMatch {
  reference: CreativeNode;
  score: number;
  reasons: string[];
  evidenceIds: string[];
}

export interface ReferenceMatchRequest {
  workNodeId: string;
  techniqueIds?: string[];
  preferredNodeTypes?: CreativeNode["type"][];
  limit?: number;
}

export class ReferenceMatchEngine {
  constructor(private readonly graph: CreativeGraphRepository) {}

  async findMatches(request: ReferenceMatchRequest): Promise<ReferenceMatch[]> {
    const relations = await this.graph.getRelations(request.workNodeId);
    const techniqueIds = new Set(request.techniqueIds ?? []);
    const preferredTypes = new Set(request.preferredNodeTypes ?? []);

    const matches = await Promise.all(
      relations
        .filter((relation) => relation.from === request.workNodeId || relation.to === request.workNodeId)
        .map(async (relation) => {
          const candidateId = relation.from === request.workNodeId ? relation.to : relation.from;
          const candidate = await this.graph.getNode(candidateId);
          if (!candidate || candidate.id === request.workNodeId) return undefined;

          let score = relation.weight ?? 1;
          const reasons: string[] = [relation.type.replaceAll("_", " ")];

          if (preferredTypes.has(candidate.type)) {
            score += 2;
            reasons.push("preferred reference type");
          }

          if (techniqueIds.has(candidate.id)) {
            score += 4;
            reasons.push("requested technique match");
          }

          return {
            reference: candidate,
            score,
            reasons,
            evidenceIds: relation.evidenceIds,
          } satisfies ReferenceMatch;
        }),
    );

    return matches
      .filter((match): match is ReferenceMatch => Boolean(match))
      .sort((a, b) => b.score - a.score)
      .slice(0, request.limit ?? 10);
  }
}
