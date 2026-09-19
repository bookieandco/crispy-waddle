import type {
  CompetitiveEvidenceSource,
  CompetitorObservation,
} from "../../../../../packages/opportunity-contracts/src";
import type { AsyncCompetitiveEvidenceRepository } from "../../../../../packages/competitive-intelligence/src/supabase-repository";

export interface AuthenticatedCompetitiveEvidenceRepository {
  recordObservation(input: {
    source: CompetitiveEvidenceSource;
    observation: CompetitorObservation;
  }): ReturnType<AsyncCompetitiveEvidenceRepository["recordObservation"]>;
  get(evidenceId: string): ReturnType<AsyncCompetitiveEvidenceRepository["get"]>;
}

/**
 * Removes ownerId from the application-facing contract. Ownership is bound
 * once, from an already verified identity, before any capability consumer can
 * reach the persistence adapter.
 */
export function bindAuthenticatedCompetitiveEvidenceRepository(
  repository: AsyncCompetitiveEvidenceRepository,
  ownerId: string,
): AuthenticatedCompetitiveEvidenceRepository {
  if (ownerId.trim() === "") throw new Error("Authenticated owner ID is required");

  return {
    recordObservation: (input) =>
      repository.recordObservation({
        ownerId,
        source: input.source,
        observation: input.observation,
      }),
    get: (evidenceId) => repository.get(ownerId, evidenceId),
  };
}
