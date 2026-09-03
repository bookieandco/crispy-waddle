import { describe, expect, it, vi } from "vitest";
import { executeVerifiedRestoration } from "./verified-execution.js";
import { RestorationProvenanceLedger, type MusicArtifact } from "./provenance-ledger.js";
import type { RestorationExecutionAuthorization } from "./execution-authorization.js";
import type { RestorationCandidate, RestorationGateDecision, RestorationPlan, RestorationQcResult } from "./types.js";

const authorization: RestorationExecutionAuthorization = {
  id: "execution-auth:plan-1:candidate-1:judgment-1",
  planId: "plan-1",
  candidateId: "candidate-1",
  sourceArtifactId: "source",
  decision: "restore",
  authorized: true,
  requiresHumanReview: false,
  gateReason: "allowed",
  evidenceIds: ["e1"],
  reasons: [],
};

const candidate: RestorationCandidate = {
  id: "candidate-1",
  operation: "declick",
  operationClass: "correction",
  status: "rendered",
  inputArtifactId: "source",
  parameters: {},
  evidenceIds: ["e1"],
  provenance: "derived",
};

const plan: RestorationPlan = {
  id: "plan-1",
  caseId: "case-1",
  sourceVersionId: "source-version-1",
  evidenceIds: ["e1"],
  candidates: [candidate],
  requiresApproval: false,
};

const qc: RestorationQcResult = {
  passed: true,
  conservationPassed: true,
  authenticityPassed: true,
  artifactFree: true,
  reasons: [],
};

const gate: RestorationGateDecision = {
  allowed: true,
  reason: "allowed",
  candidateId: candidate.id,
};

const source: MusicArtifact = {
  id: "source",
  kind: "source",
  contentHash: "source-hash",
  sampleRate: 48000,
  channels: 2,
  sampleCount: 48000,
  createdAt: "2026-09-03T00:00:00.000Z",
};

const output = (overrides: Partial<MusicArtifact> = {}): MusicArtifact => ({
  id: "output-1",
  kind: "derived",
  contentHash: "output-hash",
  sampleRate: 48000,
  channels: 2,
  sampleCount: 48000,
  parentArtifactId: "source",
  createdAt: "2026-09-03T00:00:01.000Z",
  ...overrides,
});

const input = (writer: { write: () => Promise<MusicArtifact> }) => ({
  executionId: "execution-1",
  authorization,
  plan,
  candidate,
  ledger: new RestorationProvenanceLedgerWithSource(),
  writer,
  gate,
  qc,
  expectedOutputHash: "output-hash",
  createdAt: "2026-09-03T00:00:02.000Z",
});

class RestorationProvenanceLedgerWithSource extends RestorationProvenanceLedger {
  constructor() {
    super();
    this.registerArtifact(source);
  }
}

describe("verified restoration execution", () => {
  it("promotes the artifact actually returned by the writer", async () => {
    const writer = { write: vi.fn(async () => output()) };
    const result = await executeVerifiedRestoration(input(writer));

    expect(writer.write).toHaveBeenCalledOnce();
    expect(result.status).toBe("completed");
    expect(result.receipt.hashVerified).toBe(true);
    expect(result.version?.outputArtifactId).toBe("output-1");
  });

  it("blocks promotion on an output hash mismatch", async () => {
    const writer = { write: vi.fn(async () => output({ contentHash: "wrong-hash" })) };
    const result = await executeVerifiedRestoration(input(writer));

    expect(result.version).toBeUndefined();
    expect(result.receipt.qc.passed).toBe(false);
    expect(result.receipt.reasons).toContain("output-hash-mismatch");
    expect(result.ledger?.getVersion?.("restoration-version:execution-1")).toBeUndefined();
  });

  it("blocks promotion and registration when output lineage is wrong", async () => {
    const writer = { write: vi.fn(async () => output({ parentArtifactId: "other-source" })) };
    const result = await executeVerifiedRestoration(input(writer));

    expect(result.version).toBeUndefined();
    expect(result.receipt.qc.passed).toBe(false);
    expect(result.receipt.reasons).toContain("output-lineage-mismatch");
    expect(result.ledger?.getArtifact?.("output-1")).toBeUndefined();
  });

  it("permanently audits writer failure without producing a version", async () => {
    const writer = { write: vi.fn(async () => { throw new Error("render failed"); }) };
    const result = await executeVerifiedRestoration(input(writer));

    expect(result.status).toBe("failed");
    expect(result.version).toBeUndefined();
    expect(result.receipt.reasons).toContain("execution-failed");
    expect(result.receipt.outputArtifactId).toBeUndefined();
  });

  it("never invokes the writer when authorization is denied", async () => {
    const writer = { write: vi.fn(async () => output()) };
    await expect(executeVerifiedRestoration(input(writer)).then(() => undefined)).rejects.toThrow(
      "Restoration execution denied by authorization boundary",
    );
    expect(writer.write).not.toHaveBeenCalled();
  });
});
