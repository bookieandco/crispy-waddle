import {
  DeterministicCompetitiveEvidenceRecorder,
  SupabaseCompetitiveEvidenceRepository,
  type AsyncCompetitiveEvidenceRepository,
} from "@jhadina/competitive-intelligence";
import type {
  CompetitiveEvidenceSource,
  CompetitorObservation,
} from "@jhadina/opportunity-contracts";
import { createClient } from "../supabase/server";
import { SupabaseActionIdentityVerifier } from "../auth/supabase-identity-verifier";
import type { SupabaseClaims } from "../auth/supabase-identity-verifier";

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

/**
 * Builds the request-scoped competitive-evidence repository.
 *
 * The owner is derived from server-verified Supabase claims. Callers never
 * supply ownerId, and the repository therefore cannot be used to write or
 * read another user's evidence by changing a request payload field.
 */
export async function createAuthenticatedCompetitiveEvidenceRepository(): Promise<AuthenticatedCompetitiveEvidenceRepository> {
  const supabase = await createClient();
  const claimsClient = {
    auth: {
      async getClaims() {
        const { data, error } = await supabase.auth.getClaims();
        return {
          data: { claims: data?.claims ?? null },
          error: error ? { message: error.message } : null,
        };
      },
    },
  };

  const identityVerifier = new SupabaseActionIdentityVerifier(claimsClient);
  const identity = await verifiedIdentity(identityVerifier, claimsClient);
  const repository = new SupabaseCompetitiveEvidenceRepository(
    supabase,
    new DeterministicCompetitiveEvidenceRecorder(),
  );

  return bindAuthenticatedCompetitiveEvidenceRepository(repository, identity.userId);
}

async function verifiedIdentity(
  verifier: SupabaseActionIdentityVerifier,
  claimsClient: {
    auth: {
      getClaims(): Promise<{
        data: { claims: SupabaseClaims | null };
        error: { message: string } | null;
      }>;
    };
  },
) {
  const { data, error } = await claimsClient.auth.getClaims();
  if (error) throw new Error(`Supabase identity verification failed: ${error.message}`);
  const userId = typeof data.claims?.sub === "string" ? data.claims.sub : "";
  if (!userId) throw new Error("Authenticated user missing");
  return verifier.verify({ userId });
}
