import { describe, expect, it } from "vitest";
import { DeterministicCompetitiveEvidenceRecorder } from "./index";
import { SupabaseCompetitiveEvidenceRepository } from "./supabase-repository";

const input = {
  ownerId: "owner-a",
  source: {
    sourceId: "etsy-listing-1",
    sourceType: "marketplace" as const,
    locator: "https://example.test/listing/1",
    observedAt: "2026-08-30T12:00:00.000Z",
  },
  observation: {
    competitorId: "competitor-1",
    productId: "product-1",
    marketplace: "etsy",
    listingUrl: "https://example.test/listing/1",
    priceMinor: 1999,
    currency: "USD",
    availability: "available" as const,
    observedAt: "2026-08-30T12:00:00.000Z",
  },
};

function makeClient() {
  const rows = new Map<string, any>();
  let duplicateNextInsert = false;

  const client = {
    from() {
      return {
        insert(value: any) {
          return {
            select() {
              return {
                async maybeSingle() {
                  if (duplicateNextInsert || rows.has(value.evidence_id)) {
                    duplicateNextInsert = false;
                    return { data: null, error: { code: "23505", message: "duplicate key" } };
                  }
                  rows.set(value.evidence_id, structuredClone(value));
                  return { data: structuredClone(value), error: null };
                },
              };
            },
          };
        },
        select() {
          const filters: Record<string, string> = {};
          const builder: any = {
            eq(column: string, value: string) {
              filters[column] = value;
              return builder;
            },
            async maybeSingle() {
              const row = [...rows.values()].find((candidate) =>
                Object.entries(filters).every(([key, value]) => candidate[key] === value),
              );
              return { data: row ? structuredClone(row) : null, error: null };
            },
          };
          return builder;
        },
      };
    },
    forceDuplicate() {
      duplicateNextInsert = true;
    },
    rows,
  };

  return client;
}

describe("SupabaseCompetitiveEvidenceRepository", () => {
  it("persists an observed fact and retrieves it by owner and evidence ID", async () => {
    const client = makeClient();
    const repo = new SupabaseCompetitiveEvidenceRepository(
      client,
      new DeterministicCompetitiveEvidenceRecorder(),
    );

    const evidence = await repo.recordObservation(input);
    const retrieved = await repo.get("owner-a", evidence.evidenceId);

    expect(retrieved).toEqual(evidence);
    expect(retrieved?.kind).toBe("observed_fact");
    expect(retrieved?.value.priceMinor).toBe(1999);
  });

  it("deduplicates a concurrent duplicate without overwriting the append-only row", async () => {
    const client = makeClient();
    const repo = new SupabaseCompetitiveEvidenceRepository(
      client,
      new DeterministicCompetitiveEvidenceRecorder(),
    );

    const first = await repo.recordObservation(input);
    client.forceDuplicate();
    const second = await repo.recordObservation(input);

    expect(second).toEqual(first);
    expect(client.rows.size).toBe(1);
  });

  it("enforces owner-scoped retrieval", async () => {
    const client = makeClient();
    const repo = new SupabaseCompetitiveEvidenceRepository(
      client,
      new DeterministicCompetitiveEvidenceRecorder(),
    );

    const evidence = await repo.recordObservation(input);

    expect(await repo.get("owner-b", evidence.evidenceId)).toBeUndefined();
  });

  it("does not invent non-observed evidence kinds", async () => {
    const client = makeClient();
    const repo = new SupabaseCompetitiveEvidenceRepository(
      client,
      new DeterministicCompetitiveEvidenceRecorder(),
    );

    const evidence = await repo.recordObservation(input);
    expect(evidence.kind).toBe("observed_fact");
  });
});
