import { describe, expect, it } from "vitest";
import { SupabaseSubsystemIntelligenceInbox } from "./supabase-subsystem-intelligence-inbox";

function client() {
  const rows = new Map<string, any>();
  return {
    rows,
    from() {
      return {
        async insert(row:any) {
          if (rows.has(row.id)) return { error: { code: "23505", message: "duplicate" } };
          rows.set(row.id, structuredClone(row));
          return { error: null };
        },
        select() {
          return {
            eq(_field:string, id:string) {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return { data: structuredClone(rows.get(id)), error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

const request:any = {
  actorId: "u1",
  assetId: "a1",
  assetRef: "supabase://private/trusted/u1/a.pdf",
  mediaType: "application/pdf",
  privacyClass: "sensitive",
  contentSha256: "a".repeat(64),
  evidence: [{ id: "asset:a1:page:0", source: "perception:document", observedAt: "2026-09-19T00:00:00Z", summary: "page", immutable: true }],
  uncertainty: [],
  intent: "research this",
};

describe("SupabaseSubsystemIntelligenceInbox", () => {
  it("persists a bounded subsystem handoff", async () => {
    const fake:any = client();
    const inbox = new SupabaseSubsystemIntelligenceInbox(fake);
    const result = await inbox.enqueue("research", request, { queueId: "q1" });
    expect(result.acceptedEvidenceIds).toEqual(["asset:a1:page:0"]);
    expect(fake.rows.get(result.inboxId).subsystem).toBe("research");
  });

  it("accepts an identical replay but rejects conflicting immutable identity", async () => {
    const fake:any = client();
    const inbox = new SupabaseSubsystemIntelligenceInbox(fake);
    await inbox.enqueue("research", request, { queueId: "q1" });
    await expect(inbox.enqueue("research", request, { queueId: "q1" })).resolves.toBeDefined();
    await expect(inbox.enqueue("research", { ...request, intent: "different" }, { queueId: "q1" }))
      .rejects.toThrow("ID_CONFLICT");
  });

  it("rejects evidence from another asset", async () => {
    const inbox = new SupabaseSubsystemIntelligenceInbox(client() as any);
    await expect(inbox.enqueue("research", {
      ...request,
      evidence: [{ ...request.evidence[0], id: "asset:other:page:0" }],
    })).rejects.toThrow("EVIDENCE_NOT_ASSET_BOUND");
  });
});
