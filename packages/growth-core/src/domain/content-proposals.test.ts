import { describe, expect, it } from "vitest";
import { createGrowthDraft, listGrowthDrafts } from "./content-proposals.js";

describe("growth content proposals", () => {
  it("keeps proposal ownership scoped to the package domain and user", () => {
    const draft = createGrowthDraft({
      userId: "growth-user-a",
      brand: "JHADINATV",
      platforms: ["YOUTUBE"],
      kind: "VIDEO",
      body: "test",
      rationale: "test",
    });
    expect(listGrowthDrafts("growth-user-a").some((item) => item.id === draft.id)).toBe(true);
    expect(listGrowthDrafts("growth-user-b").some((item) => item.id === draft.id)).toBe(false);
  });
});
