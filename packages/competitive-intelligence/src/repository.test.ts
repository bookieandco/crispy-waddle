import { describe, expect, it } from "vitest";
import { DeterministicCompetitiveEvidenceRecorder } from "./index";
import { InMemoryCompetitiveEvidenceRepository } from "./repository";

const input = {
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

describe("InMemoryCompetitiveEvidenceRepository", () => {
  it("deduplicates the same observation", () => {
    const repo = new InMemoryCompetitiveEvidenceRepository(new DeterministicCompetitiveEvidenceRecorder());
    const first = repo.recordObservation(input);
    const second = repo.recordObservation(input);
    expect(first.evidenceId).toBe(second.evidenceId);
    expect(repo.get(first.evidenceId)).toBe(first);
  });

  it("retrieves the immutable stored evidence", () => {
    const repo = new InMemoryCompetitiveEvidenceRepository(new DeterministicCompetitiveEvidenceRecorder());
    const evidence = repo.recordObservation(input);
    expect(repo.get(evidence.evidenceId)?.value.priceMinor).toBe(1999);
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.value)).toBe(true);
    expect(Object.isFrozen(evidence.source)).toBe(true);
  });

  it("returns undefined for an unknown evidence ID", () => {
    const repo = new InMemoryCompetitiveEvidenceRepository(new DeterministicCompetitiveEvidenceRecorder());
    expect(repo.get("missing")).toBeUndefined();
  });
});
