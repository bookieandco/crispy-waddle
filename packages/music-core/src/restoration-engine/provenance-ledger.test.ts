import { describe, expect, it } from "vitest";
import { RestorationProvenanceLedger } from "./provenance-ledger.js";

describe("restoration provenance ledger", () => {
  it("requires registered parent artifacts and preserves lineage", () => {
    const ledger = new RestorationProvenanceLedger();
    ledger.registerArtifact({ id: "source", kind: "source", contentHash: "sha-source", sampleRate: 48000, channels: 2, sampleCount: 1000, createdAt: "2026-09-03T00:00:00Z" });
    ledger.registerArtifact({ id: "candidate", kind: "derived", contentHash: "sha-candidate", sampleRate: 48000, channels: 2, sampleCount: 1000, parentArtifactId: "source", createdAt: "2026-09-03T00:01:00Z" });
    const version = ledger.createVersion({ id: "version-1", caseId: "case-1", sourceArtifactId: "source", outputArtifactId: "candidate", candidateId: "candidate-1", operationClass: "correction", operation: "declick", evidenceIds: ["damage-1", "damage-1"], authorizationIds: ["auth-1"], qcPassed: true, createdAt: "2026-09-03T00:02:00Z" });
    expect(version.evidenceIds).toEqual(["damage-1"]);
    expect(ledger.getVersion("version-1")?.outputArtifactId).toBe("candidate");
    expect(ledger.getEntries()).toHaveLength(3);
  });

  it("rejects un-QC'd non-analysis versions", () => {
    const ledger = new RestorationProvenanceLedger();
    ledger.registerArtifact({ id: "source", kind: "source", contentHash: "sha-source", sampleRate: 48000, channels: 2, sampleCount: 1000, createdAt: "2026-09-03T00:00:00Z" });
    ledger.registerArtifact({ id: "candidate", kind: "derived", contentHash: "sha-candidate", sampleRate: 48000, channels: 2, sampleCount: 1000, parentArtifactId: "source", createdAt: "2026-09-03T00:01:00Z" });
    expect(() => ledger.createVersion({ id: "version-1", caseId: "case-1", sourceArtifactId: "source", outputArtifactId: "candidate", operationClass: "correction", operation: "declick", evidenceIds: [], authorizationIds: [], qcPassed: false, createdAt: "2026-09-03T00:02:00Z" })).toThrow("passed QC");
  });
});
