import { describe, expect, it, vi } from "vitest";
import { authorizeRestorationTrialRender } from "./execution-authorization.js";
import {
  promoteMeasuredRestorationTrial,
  renderRestorationTrial,
} from "./measured-trial-execution.js";
import { RestorationProvenanceLedger, type MusicArtifact } from "./provenance-ledger.js";
import type { RestorationCandidate, RestorationPlan, RestorationQcResult } from "./types.js";

const source: MusicArtifact = {
  id: "source",
  kind: "source",
  contentHash: "source-hash",
  sampleRate: 48000,
  channels: 2,
  sampleCount: 96000,
  createdAt: "2026-10-01T00:00:00.000Z",
};
const output: MusicArtifact = {
  id: "trial-output",
  kind: "derived",
  contentHash: "trial-hash",
  sampleRate: 48000,
  channels: 2,
  sampleCount: 96000,
  parentArtifactId: source.id,
  createdAt: "2026-10-01T00:00:01.000Z",
};
const candidate: RestorationCandidate = {
  id: "candidate-1",
  operation: "dehum",
  operationClass: "correction",
  status: "proposed",
  inputArtifactId: source.id,
  parameters: { fundamentalHz: 60 },
  evidenceIds: ["hum:e1"],
  provenance: "derived",
};
const plan = (requiresApproval = false): RestorationPlan => ({
  id: "plan-1",
  caseId: "case-1",
  sourceVersionId: "source-version-1",
  evidenceIds: ["hum:e1"],
  candidates: [candidate],
  requiresApproval,
});
const passedQc: RestorationQcResult = {
  passed: true,
  conservationPassed: true,
  authenticityPassed: true,
  artifactFree: true,
  reasons: ["measured-output-pass"],
};

describe("measured restoration trial execution", () => {
  it("renders with evidence-only authority and cannot create a version by rendering", async () => {
    const p = plan();
    const authorization = authorizeRestorationTrialRender({ plan: p, candidateId: candidate.id });
    const writer = { write: vi.fn(async () => output) };
    const result = await renderRestorationTrial({ authorization, plan: p, candidate, source, writer });
    expect(result.artifact.id).toBe("trial-output");
    expect(result.authorization.authorityScope).toBe("render-only");
    expect(writer.write).toHaveBeenCalledOnce();
  });

  it("promotes only after measured QC passes and records both authority stages", () => {
    const p = plan();
    const trialAuthorization = authorizeRestorationTrialRender({ plan: p, candidateId: candidate.id });
    const ledger = new RestorationProvenanceLedger();
    const result = promoteMeasuredRestorationTrial({
      executionId: "exec-1",
      trialAuthorization,
      plan: p,
      candidate,
      source,
      artifact: output,
      qc: passedQc,
      ledger,
      createdAt: "2026-10-01T00:00:02.000Z",
    });
    expect(result.promotionAuthorization.authorityScope).toBe("promotion");
    expect(result.receipt.qc.passed).toBe(true);
    expect(result.version?.outputArtifactId).toBe(output.id);
    expect(result.version?.authorizationIds).toEqual([
      trialAuthorization.id,
      result.promotionAuthorization.id,
    ]);
  });

  it("retains a failed measured trial as evidence without creating a version", () => {
    const p = plan();
    const trialAuthorization = authorizeRestorationTrialRender({ plan: p, candidateId: candidate.id });
    const ledger = new RestorationProvenanceLedger();
    const result = promoteMeasuredRestorationTrial({
      executionId: "exec-2",
      trialAuthorization,
      plan: p,
      candidate,
      source,
      artifact: output,
      qc: { ...passedQc, passed: false, artifactFree: false, reasons: ["translation-regression"] },
      ledger,
      createdAt: "2026-10-01T00:00:02.000Z",
    });
    expect(result.promotionAuthorization.authorized).toBe(false);
    expect(result.version).toBeUndefined();
    expect(ledger.getArtifact(output.id)?.id).toBe(output.id);
  });

  it("preserves explicit approval requirements instead of silently promoting", () => {
    const p = plan(true);
    const trialAuthorization = authorizeRestorationTrialRender({ plan: p, candidateId: candidate.id });
    const result = promoteMeasuredRestorationTrial({
      executionId: "exec-3",
      trialAuthorization,
      plan: p,
      candidate,
      source,
      artifact: output,
      qc: passedQc,
      ledger: new RestorationProvenanceLedger(),
      createdAt: "2026-10-01T00:00:02.000Z",
    });
    expect(result.gate.allowed).toBe(false);
    expect(result.promotionAuthorization.authorized).toBe(false);
    expect(result.version).toBeUndefined();
  });
});
