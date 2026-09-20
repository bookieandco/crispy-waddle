import type {
  SubsystemId,
  SubsystemIntelligenceAdapter,
  SubsystemIntelligenceRequest,
  SubsystemIntelligenceResponse,
} from "@jhadina/intelligence-core";
import type {
  SubsystemInboxPayload,
  SubsystemInboxReceipt,
} from "./supabase-subsystem-intelligence-inbox";
import { SupabaseSubsystemIntelligenceInbox } from "./supabase-subsystem-intelligence-inbox";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductionSubsystemReadiness = {
  subsystem: SubsystemId;
  delivery: "durable-inbox";
  executionAuthority: false;
  notes: string;
};

export type ProductionSubsystemRegistry = {
  adapters: readonly SubsystemIntelligenceAdapter[];
  readiness: readonly ProductionSubsystemReadiness[];
};

export interface SubsystemInboxWriter {
  enqueue(
    subsystem: SubsystemId,
    input: SubsystemIntelligenceRequest,
    payload?: SubsystemInboxPayload,
  ): Promise<SubsystemInboxReceipt>;
}

const PAYLOADS: Readonly<Record<SubsystemId, SubsystemInboxPayload>> = Object.freeze({
  "sports-intelligence": Object.freeze({
    schema: "jhadina.sports-intelligence-intake.v1",
    mode: "intelligence-only",
    autoBet: false,
    executionAllowed: false,
  }),
  "director-studio": Object.freeze({
    schema: "jhadina.director-intelligence-intake.v1",
    mode: "analysis-only",
    mediaMutationAllowed: false,
    executionBoundary: "director-action-executor",
  }),
  "jhadina-media": Object.freeze({
    schema: "jhadina.music-intelligence-intake.v1",
    mode: "restoration-analysis-intake",
    sourceMutationAllowed: false,
    executionAllowed: false,
  }),
  "creative-engine": Object.freeze({
    schema: "jhadina.creative-intelligence-intake.v1",
    stage: "photo_received",
    generationAllowed: false,
    fulfillmentAllowed: false,
  }),
  overageos: Object.freeze({
    schema: "jhadina.overage-source-intake.v1",
    stage: "source-document",
    promotionAllowed: false,
    verificationRequired: true,
    externalExecutionAllowed: false,
  }),
  knowledge: Object.freeze({
    schema: "jhadina.knowledge-intake.v1",
    stage: "authorized-evidence-staging",
    canonicalGraphAdmissionAllowed: false,
    actorScopedAdmissionRequired: true,
  }),
  research: Object.freeze({
    schema: "jhadina.research-intake.v1",
    authorizationClass: "analysis",
    productionAuthority: false,
    externalExecutionAllowed: false,
  }),
});

const NOTES: Readonly<Record<SubsystemId, string>> = Object.freeze({
  "sports-intelligence": "Durable evidence handoff only; sports analysis has no betting authority.",
  "director-studio": "Durable analysis handoff; Director mutations remain behind ActionExecutor/QC/asset approval.",
  "jhadina-media": "Durable restoration-analysis handoff; restoration/mastering remains separately governed.",
  "creative-engine": "Durable creative intake at photo_received semantics; generation/fulfillment are not invoked here.",
  overageos: "Durable source-document handoff only; no lead/opportunity/claimant/claim promotion occurs here.",
  knowledge: "Actor-scoped evidence is staged before any canonical knowledge-graph admission.",
  research: "Durable analysis-only research handoff; queue execution requires the Research runtime.",
});

class DurableInboxSubsystemAdapter implements SubsystemIntelligenceAdapter {
  constructor(
    readonly subsystem: SubsystemId,
    private readonly inbox: SubsystemInboxWriter,
  ) {}

  async ingest(input: SubsystemIntelligenceRequest): Promise<SubsystemIntelligenceResponse> {
    const receipt = await this.inbox.enqueue(this.subsystem, input, PAYLOADS[this.subsystem]);
    return Object.freeze({
      subsystem: this.subsystem,
      acceptedEvidenceIds: Object.freeze([...receipt.acceptedEvidenceIds]),
      receiptId: receipt.receiptId,
    });
  }
}

export const PRODUCTION_SUBSYSTEM_IDS: readonly SubsystemId[] = Object.freeze([
  "sports-intelligence",
  "director-studio",
  "jhadina-media",
  "creative-engine",
  "overageos",
  "knowledge",
  "research",
]);

export function createProductionSubsystemRegistryFromInbox(
  inbox: SubsystemInboxWriter,
): ProductionSubsystemRegistry {
  const adapters = PRODUCTION_SUBSYSTEM_IDS.map(
    (subsystem) => new DurableInboxSubsystemAdapter(subsystem, inbox),
  );
  const readiness = PRODUCTION_SUBSYSTEM_IDS.map((subsystem) => Object.freeze({
    subsystem,
    delivery: "durable-inbox" as const,
    executionAuthority: false as const,
    notes: NOTES[subsystem],
  }));

  return Object.freeze({
    adapters: Object.freeze(adapters),
    readiness: Object.freeze(readiness),
  });
}

export function createProductionSubsystemRegistry(
  client: SupabaseClient,
): ProductionSubsystemRegistry {
  return createProductionSubsystemRegistryFromInbox(
    new SupabaseSubsystemIntelligenceInbox(client),
  );
}
