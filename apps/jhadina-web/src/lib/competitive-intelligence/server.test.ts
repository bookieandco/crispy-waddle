import { describe, expect, it, vi } from "vitest";
import type { CompetitiveEvidence } from "@jhadina/opportunity-contracts";
import type { CompetitorObservation } from "@jhadina/opportunity-contracts";
import type { RawCompetitiveObservation } from "@jhadina/competitive-intelligence";
import {
  bindAuthenticatedCompetitiveEvidenceRepository,
} from "./server";
import type { AsyncCompetitiveEvidenceRepository } from "@jhadina/competitive-intelligence";

const observation: CompetitorObservation = {
  competitorId: "competitor-a",
  productId: "product-a",
  marketplace: "marketplace-a",
  listingUrl: "https://example.test/listing-a",
  title: "Example",
  price: 19.99,
  currency: "USD",
  availability: "in_stock",
  observedAt: "2026-09-01T12:00:00.000Z",
};

const source = {
  sourceId: "source-a",
  sourceType: "api" as const,
  locator: "listing-a",
  observedAt: "2026-09-01T12:00:00.000Z",
};

function fakeRepository() {
  const recordObservation = vi.fn(async (input: RawCompetitiveObservation) => ({
    evidenceId: "evidence-a",
    ownerId: input.ownerId,
    kind: "observed_fact" as const,
    subjectId: "product-a",
    value: input.observation,
    source: input.source,
    createdAt: input.observation.observedAt,
  })) as AsyncCompetitiveEvidenceRepository["recordObservation"];

  const get = vi.fn(async (ownerId: string, evidenceId: string) =>
    evidenceId === "evidence-a"
      ? ({
          evidenceId,
          ownerId,
          kind: "observed_fact" as const,
          subjectId: "product-a",
          value: observation,
          source,
          createdAt: observation.observedAt,
        } satisfies CompetitiveEvidence<CompetitorObservation>)
      : undefined,
  ) as AsyncCompetitiveEvidenceRepository["get"];

  return { recordObservation, get };
}

describe("authenticated competitive evidence boundary", () => {
  it("injects the verified owner and does not expose ownerId to callers", async () => {
    const repository = fakeRepository();
    const bound = bindAuthenticatedCompetitiveEvidenceRepository(repository, "user-a");

    await bound.recordObservation({ source, observation });

    expect(repository.recordObservation).toHaveBeenCalledWith({
      ownerId: "user-a",
      source,
      observation,
    });
  });

  it("scopes reads to the verified owner", async () => {
    const repository = fakeRepository();
    const bound = bindAuthenticatedCompetitiveEvidenceRepository(repository, "user-a");

    await bound.get("evidence-a");

    expect(repository.get).toHaveBeenCalledWith("user-a", "evidence-a");
  });

  it("rejects an empty verified owner", () => {
    expect(() => bindAuthenticatedCompetitiveEvidenceRepository(fakeRepository(), "  ")).toThrow(
      "Authenticated owner ID is required",
    );
  });
});
