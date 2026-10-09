import { describe, expect, it } from "vitest";
import { separateDeepDrumArtifact } from "./deep-drum-separation-runtime.js";
import { sha256Hex, type RestorationArtifactStore, type StoredRestorationArtifact } from "./ingest-runtime.js";
import type { DeepDrumSeparationReceipt, RestorationRuntimeClient } from "./runtime-contract.js";

const roles = ["kick", "snare", "hihat", "cymbals", "toms", "residual"] as const;

function parent(): StoredRestorationArtifact {
  return {
    id: "drum-parent", parentArtifactId: "original", kind: "derived", role: "drums",
    contentHash: "a".repeat(64), ownerUserId: "owner", caseId: "case",
    sampleRate: 48000, channels: 2, sampleCount: 48000,
    createdAt: "2026-10-07T00:00:00Z", mimeType: "audio/wav",
    sizeBytes: 1000, storageUri: "memory://drums",
  };
}

describe("deep drum artifact integration", () => {
  it("registers actual rehashed audio with parent lineage and abstains from quality claims", async () => {
    const stemBytes = new Map<string, Uint8Array>();
    const stems = await Promise.all(roles.map(async role => {
      const bytes = new TextEncoder().encode("audio:" + role);
      stemBytes.set(role, bytes);
      return {
        artifactId: "sub-" + role, parentArtifactId: "drum-parent",
        role, resultUri: "/v1/jobs/012345678901234567890123/artifact/" + role + ".wav",
        sha256: await sha256Hex(bytes), sampleRate: 48000, channels: 2,
        sampleCount: 48000, durationSeconds: 1, modelId: "drumsep-cpu-v1" as const,
        modelVersion: "1.0.0", confidence: 0, confidenceStatus: "unmeasured" as const,
        sourceKind: "recursive-separation" as const, runtimeReceiptId: "receipt-" + role,
      };
    }));
    const receipt: DeepDrumSeparationReceipt = {
      jobId: "job", sourceArtifactId: "drum-parent", sourceSha256: "a".repeat(64),
      parentRole: "drums", modelId: "drumsep-cpu-v1", modelVersion: "1.0.0",
      stems: [...stems], qc: {
        residualRmsRatio: 0.3, residualEnergyRatio: 0.09,
        recombinationErrorRatio: 0.00000003,
        maxAbsoluteRecombinationError: 0.0000001,
        recombinedRenderMeasured: true, isolationCertified: false,
      },
      restorationCertified: false, needsListeningReview: true,
      runtimeReceiptId: "deep-receipt",
    };
    const registered: StoredRestorationArtifact[] = [];
    const store = {
      resolveRuntimeUri: async () => "https://store.example/signed-drum-parent",
      get: async () => undefined,
      putDerived: async ({ artifactId }: { artifactId: string }) => ({
        storageUri: "memory://" + artifactId, runtimeUri: "https://store.example/" + artifactId,
      }),
      register: async (artifact: StoredRestorationArtifact) => { registered.push(artifact); },
    } as unknown as RestorationArtifactStore;
    const runtime = {
      separateDeepDrums: async () => receipt,
      downloadArtifact: async (uri: string) => {
        const role = uri.split("/").at(-1)?.replace(".wav", "") ?? "";
        return stemBytes.get(role) ?? new Uint8Array();
      },
    } as unknown as RestorationRuntimeClient;
    const result = await separateDeepDrumArtifact({
      ownerUserId: "owner", caseId: "case", parent: parent(),
      runtime, store, jobId: "job",
    });
    expect(registered.map(artifact => artifact.role)).toEqual(roles.map(role => "drums." + role));
    expect(result.decomposition.maxDepth).toBe(2);
    expect(result.decomposition.nodes.every(node => !node.canonicalSource)).toBe(true);
    expect(result.receipt.restorationCertified).toBe(false);
    expect(result.artifacts[0]?.parentArtifactId).toBe("drum-parent");
  });

  it("rejects spoofed parent and missing models", async () => {
    const model = {} as RestorationRuntimeClient;
    const store = {} as RestorationArtifactStore;
    await expect(separateDeepDrumArtifact({
      ownerUserId: "attacker", caseId: "case", parent: parent(), runtime: model,
      store, jobId: "job",
    })).rejects.toThrow("authenticated");
    await expect(separateDeepDrumArtifact({
      ownerUserId: "owner", caseId: "case", parent: parent(),
      runtime: model, store, jobId: "job",
    })).rejects.toThrow("not commissioned");
  });

  it("rejects malformed parent-child receipts before persisting", async () => {
    const old = parent();
    const store = {
      resolveRuntimeUri: async () => "https://store.example/parent",
    } as unknown as RestorationArtifactStore;
    const runtime = {
      separateDeepDrums: async () => ({
        jobId: "job", sourceArtifactId: old.id, sourceSha256: old.contentHash,
        modelId: "drumsep-cpu-v1", parentRole: "drums", stems: [],
        restorationCertified: false, needsListeningReview: true,
        qc: { residualRmsRatio: 0, residualEnergyRatio: 0,
          recombinationErrorRatio: 0, maxAbsoluteRecombinationError: 0,
          recombinedRenderMeasured: true, isolationCertified: false }, runtimeReceiptId: "receipt",
      }),
    } as unknown as RestorationRuntimeClient;
    await expect(separateDeepDrumArtifact({
      ownerUserId: "owner", caseId: "case", parent: old,
      store, runtime, jobId: "job",
    })).rejects.toThrow("incomplete");
  });
});
