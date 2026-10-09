import { describe, expect, it } from "vitest";
import { readResearchBenchmarkCandidates } from "./research-benchmark-bridge.js";

const source = {
  repository: "bookieandco/music-restoration-intelligence",
  commit: "d282ec4994a821e02c0b3a93082630aea549114e",
  path: "No good.mp3",
  gitBlobSha1: "3e466a40e09bcdf0c94cb3be419c1ac713673c5a",
  sizeBytes: 4884333,
  sha256: null,
};
function fixture() {
  return {
    schemaVersion: "music-restoration-research-bridge/v1",
    canonicalRuntimeRepository: "bookieandco/crispy-waddle",
    researchRepository: source.repository,
    executionAuthority: "none",
    productionDeploymentAuthorized: false,
    driveUploadAuthorized: false,
    referenceSources: [{
      fixtureId: "MUSIC-RESTORE.AB-001",
      title: "No Good",
      source,
      rightsStatus: "review_required",
      benchmarkStatus: "defined_not_executed",
      humanReviewRequired: true,
    }],
  };
}
describe("cross-repository research fixture bridge", () => {
  it("consumes exact fixture metadata without granting rights or execution", () => {
    const result = readResearchBenchmarkCandidates(fixture());
    expect(result.candidates[0].fixture.source.gitBlobSha1).toBe(source.gitBlobSha1);
    expect(result.candidates[0].fixture.source.sha256).toBeNull();
    expect(result.candidates[0].requiresOwnerIngest).toBe(true);
    expect(result.candidates[0].requiresRightsReview).toBe(true);
    expect(result.productionAuthorized).toBe(false);
  });
  it("rejects spoofed production and Google Drive permission", () => {
    expect(() => readResearchBenchmarkCandidates({
      ...fixture(), driveUploadAuthorized: true,
    })).toThrow("CANNOT_GRANT");
    expect(() => readResearchBenchmarkCandidates({
      ...fixture(), productionDeploymentAuthorized: true,
    })).toThrow("CANNOT_GRANT");
  });
  it("blocks mutated refs, path traversal and claimed benchmark success", () => {
    const broken = fixture();
    broken.referenceSources[0].source = { ...source, path: "../token.mp3" };
    expect(() => readResearchBenchmarkCandidates(broken)).toThrow("INVALID");
    broken.referenceSources[0].source = source;
    broken.referenceSources[0].benchmarkStatus = "completed";
    expect(() => readResearchBenchmarkCandidates(broken)).toThrow("INVALID");
  });
  it("rejects same benchmark twice and non-authoritative source URL", () => {
    const data = fixture();
    const duplicated = { ...data, referenceSources: [...data.referenceSources,...data.referenceSources] };
    expect(() => readResearchBenchmarkCandidates(duplicated)).toThrow("INVALID");
    const malicious = { ...data, referenceSources: [{
      ...data.referenceSources[0], source: { ...source, repository: "attacker/repo" },
    }] };
    expect(() => readResearchBenchmarkCandidates(malicious)).toThrow("INVALID");
  });
});
