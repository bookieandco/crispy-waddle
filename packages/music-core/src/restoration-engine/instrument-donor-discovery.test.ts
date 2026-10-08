import { describe, expect, it } from "vitest";
import {
  rankInstrumentDonors,
  type InstrumentDonorCandidate,
  type InstrumentDonorSearchRequest,
} from "./instrument-donor-discovery.js";
import type { InstrumentFingerprint } from "../instrument-replacement.js";

const fp: InstrumentFingerprint = {
  family: "electric-guitar",
  spectralCentroidHz: 1900,
  spectralSpreadHz: 1600,
  lowEnergyRatio: .15, midEnergyRatio: .66, highEnergyRatio: .19,
  transientStrength: .6, harmonicity: .8,
};

function input(): InstrumentDonorSearchRequest {
  const good = {
    family: "electric-guitar" as const,
    origin: "human-verified-track" as const,
    reviewed: true, confidence: .99, evidenceIds: ["owner:reviewed:guitar"],
  };
  const candidate: InstrumentDonorCandidate = {
    id: "donor-one", artifactId: "artifact-one", ownerUserId: "owner",
    caseId: "case", canonicalRecordingId: "recording",
    label: "clean guitar phrase", relationship: "same-performance",
    fingerprint: fp, identity: good,
    gainEvidence: { method: "measured-damage-delta", expectedGain: .5, confidence: .9 },
    sourceRegion: { startMs: 18000, endMs: 18500 },
    rightsVerified: true, measuredAudioSha256: "f".repeat(64),
  };
  return {
    sourceArtifactId: "source", sourceUserId: "owner", caseId: "case",
    canonicalRecordingId: "recording", observedFingerprint: fp,
    observedIdentity: good,
    damage: {
      repairability: "unrepairable", confidence: .91, evidenceIds: ["measured-damage"],
      repairCandidatePassed: false,
    },
    donors: [candidate],
  };
}

describe("instrument donor research / guitar replacement preflight", () => {
  it("prioritizes exact-performance guitar and requires approval/listening", () => {
    const q = input();
    q.donors.push({
      ...q.donors[0], id: "other-take", artifactId: "other-take", 
      canonicalRecordingId: "recording-two", relationship: "same-song-other-take",
    });
    const result = rankInstrumentDonors(q);
    expect(result.disposition).toBe("review-replacement");
    expect(result.ranked.map(x => x.candidateId)).toEqual(["donor-one", "other-take"]);
    expect(result.ranked[0].requiresHumanApproval).toBe(true);
    expect(result.ranked[0].needsAlignmentAndListening).toBe(true);
    expect(result.replacementPerformed).toBe(false);
    expect(result.originalPreserved).toBe(true);
  });

  it("does not replace a repairable guitar", () => {
    const q = input();
    q.damage = { ...q.damage, repairability: "repairable", repairCandidatePassed: true };
    const r = rankInstrumentDonors(q);
    expect(r.disposition).toBe("repair-first");
    expect(r.ranked).toEqual([]);
  });

  it("abstains without reviewed family identification or measured damage", () => {
    const q = input();
    q.observedIdentity = { ...q.observedIdentity, reviewed: false };
    expect(rankInstrumentDonors(q).disposition).toBe("abstain");
    q.observedIdentity = input().observedIdentity;
    q.damage = { ...q.damage, evidenceIds: [] };
    expect(rankInstrumentDonors(q).disposition).toBe("abstain");
  });

  it("rejects fake guitar tags, unauthorized and cross-owner donors", () => {
    const q = input();
    q.donors = [
      { ...q.donors[0], id: "not-guitar", artifactId: "other", identity: {
        ...q.donors[0].identity, family: "acoustic-guitar" },
      },
      { ...q.donors[0], id: "unlicensed", artifactId: "unlicensed", rightsVerified: false },
      { ...q.donors[0], id: "attacker", artifactId: "foreign", ownerUserId: "attacker" },
      { ...q.donors[0], id: "same-artifact", artifactId: "source" },
    ];
    const result = rankInstrumentDonors(q);
    expect(result.disposition).toBe("preserve");
    expect(result.rejections).toHaveLength(4);
  });

  it("rejects copy/pasted family metadata on bad take and unmeasured gains", () => {
    const q = input();
    q.donors[0] = { ...q.donors[0], canonicalRecordingId: "wrong-recording" };
    expect(rankInstrumentDonors(q).ranked).toHaveLength(0);
    q.donors[0] = { ...input().donors[0],
      gainEvidence: { method: "measured", expectedGain: .02, confidence: .9 },
    };
    expect(rankInstrumentDonors(q).ranked).toHaveLength(0);
  });
});
