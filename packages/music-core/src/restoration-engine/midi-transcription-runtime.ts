import {
  sha256Hex, type RestorationArtifactStore, type StoredRestorationArtifact,
} from "./ingest-runtime.js";
import type {
  RestorationMidiTranscriptionReceipt, RestorationRuntimeClient,
} from "./runtime-contract.js";

const PARENTS = new Set(["guitar", "piano", "bass", "other"]);
const MIDI_MAX_BYTES = 16 * 1024 * 1024;

/**
 * MIDI transcription is not restoration of the original performance master:
 * note/harmonic estimates may be wrong, and any VST rendering is newly made.
 */
export async function transcribeInstrumentToMidi(input: {
  ownerUserId: string;
  caseId: string;
  parent: StoredRestorationArtifact;
  runtime: RestorationRuntimeClient;
  store: RestorationArtifactStore;
  jobId: string;
  now?: string;
}): Promise<{
  artifact: StoredRestorationArtifact;
  receipt: RestorationMidiTranscriptionReceipt;
}> {
  const { parent } = input;
  if (!parent.parentArtifactId || parent.kind !== "derived" || !PARENTS.has(parent.role ?? "") ||
      parent.ownerUserId !== input.ownerUserId || parent.caseId !== input.caseId) {
    throw new Error("MUSIC_MIDI_REQUIRES_OWNED_ISOLATED_INSTRUMENT_STEM");
  }
  if (!input.runtime.transcribePerformance) throw new Error("MUSIC_MIDI_OPTIONAL_MODEL_UNAVAILABLE");
  if (!input.jobId.trim()) throw new Error("MUSIC_MIDI_JOB_ID_REQUIRED");
  const source = {
    artifactId: parent.id,
    uri: await input.store.resolveRuntimeUri(input.ownerUserId, parent.id),
    sha256: parent.contentHash, mimeType: parent.mimeType,
  };
  const receipt = await input.runtime.transcribePerformance({
    jobId: input.jobId, source,
    parentRole: parent.role as "guitar" | "piano" | "bass" | "other",
    modelId: "spotify-basic-pitch-v1",
  });
  if (receipt.jobId !== input.jobId || receipt.sourceArtifactId !== parent.id ||
      receipt.parentArtifactId !== parent.id ||
      receipt.sourceSha256.toLowerCase() !== parent.contentHash.toLowerCase() ||
      receipt.parentRole !== parent.role || receipt.modelId !== "spotify-basic-pitch-v1" ||
      !/^[0-9a-f]{64}$/i.test(receipt.outputSha256) ||
      !/^\/v1\/jobs\/[0-9a-f]{24}\/artifact\/transcription\.mid$/.test(receipt.resultUri) ||
      !Number.isSafeInteger(receipt.noteCount) || receipt.noteCount <= 0 ||
      receipt.operationClass !== "creative-reconstruction" ||
      receipt.isOriginalPerformanceRecovered !== false ||
      receipt.needsHumanReview !== true ||
      receipt.restorationCertified !== false) {
    throw new Error("MUSIC_MIDI_RECEIPT_INVALID_OR_UNPROVEN");
  }
  if (await input.store.get(input.ownerUserId, receipt.outputArtifactId)) {
    throw new Error("MUSIC_MIDI_ARTIFACT_ALREADY_EXISTS");
  }
  const bytes = await input.runtime.downloadArtifact(receipt.resultUri);
  if (bytes.byteLength < 20 || bytes.byteLength > MIDI_MAX_BYTES ||
      bytes.byteLength !== receipt.midiBytes ||
      String.fromCharCode(...bytes.slice(0, 4)) !== "MThd" ||
      (await sha256Hex(bytes)).toLowerCase() !== receipt.outputSha256.toLowerCase()) {
    throw new Error("MUSIC_MIDI_DOWNLOAD_HEADER_SIZE_OR_SHA_MISMATCH");
  }
  const storage = await input.store.putDerived({
    ownerUserId: input.ownerUserId, caseId: input.caseId,
    artifactId: receipt.outputArtifactId, parentArtifactId: parent.id,
    fileName: "transcription.mid", mimeType: "audio/midi",
    sha256: receipt.outputSha256.toLowerCase(), bytes, role: "midi." + parent.role,
  });
  const artifact: StoredRestorationArtifact = {
    id: receipt.outputArtifactId, kind: "derived", role: "midi." + parent.role,
    contentHash: receipt.outputSha256.toLowerCase(), ownerUserId: input.ownerUserId,
    caseId: input.caseId, parentArtifactId: parent.id,
    sampleRate: parent.sampleRate, channels: parent.channels, sampleCount: parent.sampleCount,
    storageUri: storage.storageUri, mimeType: "audio/midi", sizeBytes: bytes.byteLength,
    runtimeReceiptId: receipt.runtimeReceiptId, createdAt: input.now ?? new Date().toISOString(),
  };
  await input.store.register(artifact);
  return { artifact, receipt };
}
