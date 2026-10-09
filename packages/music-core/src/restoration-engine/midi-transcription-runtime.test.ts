import { describe, expect, it } from "vitest";
import { sha256Hex, type RestorationArtifactStore, type StoredRestorationArtifact } from "./ingest-runtime.js";
import { transcribeInstrumentToMidi } from "./midi-transcription-runtime.js";
import type { RestorationMidiTranscriptionReceipt, RestorationRuntimeClient } from "./runtime-contract.js";

const parent: StoredRestorationArtifact = {
  id: "guitar-stem", parentArtifactId: "original", kind: "derived",
  contentHash: "a".repeat(64), role: "guitar", ownerUserId: "owner", caseId: "case",
  sampleRate: 48000, sampleCount: 96000, channels: 2, sizeBytes: 1500,
  mimeType: "audio/wav", storageUri: "private://guitar",
  createdAt: "2026-10-07T00:00:00Z",
};
const blob = new Uint8Array([...new TextEncoder().encode("MThd"), ...Array(40).fill(0)]);
async function fixtures() {
  const digest = await sha256Hex(blob);
  const receipt: RestorationMidiTranscriptionReceipt = {
    jobId: "job", sourceArtifactId: "guitar-stem", parentArtifactId: "guitar-stem",
    sourceSha256: "a".repeat(64), parentRole: "guitar", modelId: "spotify-basic-pitch-v1",
    modelVersion: "0.4.0", outputArtifactId: "guitar-midi-1",
    outputSha256: digest, resultUri: "/v1/jobs/012345678901234567890123/artifact/transcription.mid",
    midiBytes: blob.length, noteCount: 3, sampleRate: 48000, channels: 2, sampleCount: 96000,
    durationSeconds: 2, operationClass: "creative-reconstruction",
    isOriginalPerformanceRecovered: false, needsHumanReview: true, restorationCertified: false,
    runtimeReceiptId: "midi-receipt",
  };
  const saved: StoredRestorationArtifact[] = [];
  const store = {
    get: async () => undefined,
    resolveRuntimeUri: async () => "https://storage.example/guitar",
    putDerived: async () => ({ storageUri: "private://midi", runtimeUri: "https://storage.example/midi" }),
    register: async (item: StoredRestorationArtifact) => { saved.push(item); },
  } as unknown as RestorationArtifactStore;
  const runtime = {
    transcribePerformance: async () => receipt,
    downloadArtifact: async () => blob,
  } as unknown as RestorationRuntimeClient;
  return { receipt, saved, store, runtime };
}

describe("Basic Pitch MIDI save and creative provenance", () => {
  it("registers independently verified MIDI as derived, never recovered audio", async () => {
    const x = await fixtures();
    const result = await transcribeInstrumentToMidi({
      ownerUserId: "owner", caseId: "case", parent,
      runtime: x.runtime, store: x.store, jobId: "job",
    });
    expect(x.saved).toHaveLength(1);
    expect(result.artifact.role).toBe("midi.guitar");
    expect(result.artifact.mimeType).toBe("audio/midi");
    expect(result.artifact.parentArtifactId).toBe("guitar-stem");
    expect(result.receipt.restorationCertified).toBe(false);
  });

  it("refuses non-owned stems and vocals", async () => {
    const x = await fixtures();
    await expect(transcribeInstrumentToMidi({
      ownerUserId: "wrong", caseId: "case", parent,
      runtime: x.runtime, store: x.store, jobId: "job",
    })).rejects.toThrow("OWNED");
    await expect(transcribeInstrumentToMidi({
      ownerUserId: "owner", caseId: "case", parent: { ...parent, role: "vocals" },
      runtime: x.runtime, store: x.store, jobId: "job",
    })).rejects.toThrow("ISOLATED");
  });

  it("rejects tampered bytes and identity before persistence", async () => {
    const x = await fixtures();
    const badRuntime = { ...x.runtime,
      transcribePerformance: async () => ({ ...x.receipt, sourceSha256: "b".repeat(64) }),
    } as RestorationRuntimeClient;
    await expect(transcribeInstrumentToMidi({
      ownerUserId: "owner", caseId: "case", parent, runtime: badRuntime,
      store: x.store, jobId: "job",
    })).rejects.toThrow("RECEIPT");
    const wrongBytes = { ...x.runtime,
      downloadArtifact: async () => new TextEncoder().encode("not-a-midi-file"),
    } as RestorationRuntimeClient;
    await expect(transcribeInstrumentToMidi({
      ownerUserId: "owner", caseId: "case", parent, runtime: wrongBytes,
      store: x.store, jobId: "job",
    })).rejects.toThrow("MISMATCH");
    expect(x.saved).toHaveLength(0);
  });
});
