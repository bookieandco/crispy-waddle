import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildTikTokBusinessFactoryIntake,
  buildTikTokBusinessFactoryWorkItems,
  type TikTokBusinessFactoryEvidenceBundle,
  type TikTokBusinessFactoryLane,
  type TikTokBusinessFactoryWorkReadiness,
} from "@jhadina/growth-core";
import type {
  VentureDiscoveryCandidate,
  VentureWorkItem,
} from "@jhadina/opportunity-core";
import {
  VentureRuntimeRepository,
  type VentureScoutInboxRecord,
} from "./venture-runtime-repository";

export type TikTokBusinessFactoryPersistence = Pick<
  VentureRuntimeRepository,
  "upsertScoutSignals" | "upsertCandidates" | "getVentureByOpportunity" | "upsertWorkItems"
>;

export async function ingestTikTokBusinessFactoryEvidence(
  client: SupabaseClient,
  input: {
    evidence: TikTokBusinessFactoryEvidenceBundle;
    repository?: TikTokBusinessFactoryPersistence;
  },
): Promise<{
  seedId: string;
  candidate: VentureDiscoveryCandidate;
  signalCount: number;
  persistedSignals: number;
  persistedCandidates: number;
  externalActionAuthorized: false;
  automaticExperimentAuthorized: false;
}> {
  const repository = input.repository ?? new VentureRuntimeRepository(client);
  const intake = buildTikTokBusinessFactoryIntake(input.evidence);

  const records: VentureScoutInboxRecord[] = intake.signals.map((signal) => ({
    seedId: intake.profile.seedId,
    family: intake.profile.family,
    signal,
    sourceUrl: isHttpUrl(signal.sourceRef) ? signal.sourceRef : undefined,
    sourceTitle: [
      "TikTok Business Factory",
      input.evidence.lane,
      signal.kind,
      input.evidence.product.productName,
    ].join(" — "),
  }));

  const persistedSignals = await repository.upsertScoutSignals(records);
  const persistedCandidates = await repository.upsertCandidates([intake.candidate]);

  return Object.freeze({
    seedId: intake.profile.seedId,
    candidate: intake.candidate,
    signalCount: intake.signals.length,
    persistedSignals,
    persistedCandidates,
    externalActionAuthorized: false as const,
    automaticExperimentAuthorized: false as const,
  });
}

/**
 * The authenticated server route supplies ownerUserId. This function does not
 * infer identity and does not grant external-action authority.
 */
export async function queueTikTokBusinessFactoryWorkForOwner(
  client: SupabaseClient,
  input: {
    ownerUserId: string;
    opportunityId: string;
    lane: TikTokBusinessFactoryLane;
    readiness: TikTokBusinessFactoryWorkReadiness;
    createdAt?: string;
    repository?: TikTokBusinessFactoryPersistence;
  },
): Promise<{
  ventureId: string;
  workItems: VentureWorkItem[];
  queued: number;
  blocked: number;
  persisted: number;
  externalActionAuthorized: false;
  moneyMovementAuthorized: false;
}> {
  const repository = input.repository ?? new VentureRuntimeRepository(client);
  const ownerUserId = requireText(input.ownerUserId, "ownerUserId");
  const opportunityId = requireText(input.opportunityId, "opportunityId");
  const venture = await repository.getVentureByOpportunity(ownerUserId, opportunityId);
  if (!venture) throw new Error("TIKTOK_FACTORY_VENTURE_NOT_FOUND");

  const workItems = buildTikTokBusinessFactoryWorkItems({
    venture,
    lane: input.lane,
    readiness: input.readiness,
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
  const persisted = await repository.upsertWorkItems(ownerUserId, workItems);

  return Object.freeze({
    ventureId: venture.id,
    workItems,
    queued: workItems.filter((item) => item.status === "queued").length,
    blocked: workItems.filter((item) => item.status === "blocked").length,
    persisted,
    externalActionAuthorized: false as const,
    moneyMovementAuthorized: false as const,
  });
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`TIKTOK_FACTORY_${field.toUpperCase()}_REQUIRED`);
  return normalized;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
