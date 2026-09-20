import { describe, expect, it } from "vitest";
import {
  createProductionSubsystemRegistryFromInbox,
  PRODUCTION_SUBSYSTEM_IDS,
} from "./production-subsystem-registry";

const request:any = {
  actorId: "u1",
  assetId: "a1",
  assetRef: "supabase://private/trusted/u1/a.mp4",
  mediaType: "video/mp4",
  privacyClass: "sensitive",
  contentSha256: "a".repeat(64),
  evidence: [{ id: "asset:a1:asset-metadata:0", source: "perception:video", observedAt: "2026-09-19T00:00:00Z", summary: "video", immutable: true }],
  uncertainty: [],
  intent: "boxing footage for film analysis",
};

describe("production subsystem registry", () => {
  it("registers every universal-intake subsystem with durable non-executing handoff", async () => {
    const calls:any[] = [];
    const registry = createProductionSubsystemRegistryFromInbox({
      async enqueue(subsystem, input, payload) {
        calls.push({ subsystem, input, payload });
        return {
          inboxId: `i:${subsystem}`,
          receiptId: `r:${subsystem}`,
          acceptedEvidenceIds: input.evidence.map((e:any) => e.id),
        };
      },
    });
    expect(registry.adapters.map((adapter) => adapter.subsystem)).toEqual(PRODUCTION_SUBSYSTEM_IDS);
    expect(registry.readiness.every((item) => item.executionAuthority === false)).toBe(true);

    const sports = registry.adapters.find((adapter) => adapter.subsystem === "sports-intelligence")!;
    await sports.ingest(request);
    expect(calls[0].payload.autoBet).toBe(false);

    const overage = registry.adapters.find((adapter) => adapter.subsystem === "overageos")!;
    await overage.ingest({ ...request, mediaType: "application/pdf" });
    expect(calls[1].payload.promotionAllowed).toBe(false);
    expect(calls[1].payload.externalExecutionAllowed).toBe(false);
  });

  it("stages knowledge instead of auto-admitting private evidence to the canonical graph", async () => {
    let payload:any;
    const registry = createProductionSubsystemRegistryFromInbox({
      async enqueue(_subsystem, input, p) {
        payload = p;
        return { inboxId: "i", receiptId: "r", acceptedEvidenceIds: input.evidence.map((e:any) => e.id) };
      },
    });
    await registry.adapters.find((adapter) => adapter.subsystem === "knowledge")!.ingest(request);
    expect(payload.canonicalGraphAdmissionAllowed).toBe(false);
    expect(payload.actorScopedAdmissionRequired).toBe(true);
  });
  it("dispatches a multi-route packet with no skipped subsystem when registry is installed", async () => {
    const { GovernedSubsystemDispatcher } = await import("@jhadina/intelligence-core");
    const registry = createProductionSubsystemRegistryFromInbox({
      async enqueue(subsystem, input) {
        return {
          inboxId: `i:${subsystem}`,
          receiptId: `r:${subsystem}`,
          acceptedEvidenceIds: input.evidence.map((e:any) => e.id),
        };
      },
    });
    const dispatcher = new GovernedSubsystemDispatcher(registry.adapters);
    const result = await dispatcher.dispatch({
      asset: {
        id: "a1",
        actorId: "u1",
        modality: "video",
        mediaType: "video/mp4",
        assetRef: "supabase://private/trusted/u1/a.mp4",
        privacyClass: "sensitive",
        contentSha256: "a".repeat(64),
        byteLength: 100,
        status: "registered",
        createdAt: "2026-09-19T00:00:00Z",
      },
      evidence: request.evidence,
      uncertainty: [],
      routing: {
        assetId: "a1",
        routes: [
          { subsystem: "sports-intelligence", reason: "sports", confidence: 0.9 },
          { subsystem: "director-studio", reason: "film", confidence: 0.9 },
        ],
        requiresHumanSelection: false,
      },
    } as any, request.intent);

    expect(result.skipped).toEqual([]);
    expect(result.responses.map((item) => item.subsystem)).toEqual([
      "sports-intelligence",
      "director-studio",
    ]);
  });
});
