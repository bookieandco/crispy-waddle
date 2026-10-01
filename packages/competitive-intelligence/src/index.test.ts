import { describe, expect, it } from "vitest";
import { DeterministicCompetitiveEvidenceRecorder } from "./index";

describe("DeterministicCompetitiveEvidenceRecorder", () => {
  const recorder = new DeterministicCompetitiveEvidenceRecorder();
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

  it("records raw adapter input as an observed fact with provenance", () => {
    const evidence = recorder.recordObservation(input);
    expect(evidence.kind).toBe("observed_fact");
    expect(evidence.ownerId).toBe("owner-a");
    expect(evidence.subjectId).toBe("product-1");
    expect(evidence.source?.sourceId).toBe("etsy-listing-1");
    expect(evidence.value).toEqual(input.observation);
  });

  it("produces the same evidence ID for the same owner and observation", () => {
    expect(recorder.recordObservation(input).evidenceId).toBe(
      recorder.recordObservation(input).evidenceId,
    );
  });

  it("isolates evidence identity by owner", () => {
    const other = recorder.recordObservation({ ...input, ownerId: "owner-b" });
    expect(other.evidenceId).not.toBe(recorder.recordObservation(input).evidenceId);
    expect(other.ownerId).toBe("owner-b");
  });

  it("rejects missing owner or provenance", () => {
    expect(() => recorder.recordObservation({ ...input, ownerId: "" })).toThrow("Owner ID");
    expect(() => recorder.recordObservation({ ...input, source: { ...input.source, sourceId: "" } })).toThrow("source ID");
  });

  it("rejects invalid observation timestamps", () => {
    expect(() => recorder.recordObservation({
      ...input,
      observation: { ...input.observation, observedAt: "not-a-date" },
    })).toThrow("timestamps");
  });
});
