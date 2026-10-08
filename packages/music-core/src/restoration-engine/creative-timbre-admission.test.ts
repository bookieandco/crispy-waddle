import { describe, expect, it } from "vitest";
import {
  admitCreativeTimbreTransfer,
  type CreativeTimbreProposal,
  type LicensedTimbreModelRelease,
} from "./creative-timbre-admission.js";

const p: CreativeTimbreProposal = {
  ownerUserId: "owner", caseId: "case", sourceArtifactId: "isolated-guitar",
  sourceAudioSha256: "a".repeat(64), sourceRole: "guitar",
  performanceMode: "monophonic-isolated",
  sourceTimingEvidenceIds: ["onset:01"], pitchTrackEvidenceId: "f0:01",
  targetFamily: "electric-guitar", engine: "magenta-ddsp",
  sourceRightsVerified: true,
};
const m: LicensedTimbreModelRelease = {
  trustedRegistryAdmission: true, engine: "magenta-ddsp",
  modelVersion: "v1", checkpointSha256: "c".repeat(64),
  targetFamily: "electric-guitar",
  modelLicenseReceiptId: "license-reviewed",
  trainingAudioRightsReceiptId: "training-rights-reviewed",
  heldOutTimbreBenchmarkId: "guitar-fidelity-held-out",
  supportedModes: ["monophonic-isolated"],
};
const review = {
  approved: true, reviewerUserId: "owner", caseId: "case",
  sourceArtifactId: "isolated-guitar", reviewReceiptId: "review:ok",
};
describe("DDSP / diffusion creative sound replacement preflight", () => {
  it("retains original and forbids execution even when a vetted model is eligible", () => {
    const r = admitCreativeTimbreTransfer({ proposal: p, release: m, review });
    expect(r.action).toBe("render-eligible");
    expect(r.outputClass).toBe("creative-reconstruction");
    expect(r.originalRecovered).toBe(false);
    expect(r.sourceImmutable).toBe(true);
    expect(r.executionPerformed).toBe(false);
  });
  it("blocks polyphonic/DDSP and mixed-source proposals", () => {
    for (const performanceMode of ["polyphonic-isolated", "mixed"] as const) {
      expect(admitCreativeTimbreTransfer({
        proposal: { ...p, performanceMode }, release: m, review,
      }).action).toBe("abstain");
    }
  });
  it("blocks model weights, rights or owner mismatches", () => {
    expect(admitCreativeTimbreTransfer({
      proposal: p, release: { ...m, checkpointSha256: "bad" }, review,
    }).action).toBe("abstain");
    expect(admitCreativeTimbreTransfer({
      proposal: { ...p, sourceRightsVerified: false }, release: m, review,
    }).action).toBe("abstain");
    expect(admitCreativeTimbreTransfer({
      proposal: p, release: m, review: { ...review, reviewerUserId: "attacker" },
    }).action).toBe("abstain");
  });
  it("treats Sony diffusion as research rather than a commissioned model", () => {
    const r=admitCreativeTimbreTransfer({
      proposal: { ...p, engine: "sony-diffusion-timbre" },
      release: { ...m, engine: "sony-diffusion-timbre" }, review,
    });
    expect(r.action).toBe("abstain");
    expect(r.reasons.join(" ")).toContain("research-only");
  });
});
