import { createRestorationCase, type AudioSourceFingerprint, type RestorationCase } from "../restoration.js";
import type { MusicArtifact } from "./provenance-ledger.js";
import type {
  RestorationProbeReceipt,
  RestorationRuntimeClient,
  RestorationRuntimeSource,
} from "./runtime-contract.js";

export const MAX_RESTORATION_SOURCE_BYTES = 500 * 1024 * 1024;

const AUDIO_MIME_TYPES = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
]);

export interface StoredRestorationArtifact extends MusicArtifact {
  ownerUserId: string;
  caseId: string;
  storageUri: string;
  mimeType: string;
  sizeBytes: number;
  role?: string;
  runtimeReceiptId?: string;
}

export interface RestorationArtifactStore {
  putImmutableSource(input: {
    ownerUserId: string;
    caseId: string;
    artifactId: string;
    fileName: string;
    mimeType: string;
    sha256: string;
    bytes: Uint8Array;
  }): Promise<{ storageUri: string; runtimeUri: string }>;
  putDerived(input: {
    ownerUserId: string;
    caseId: string;
    artifactId: string;
    parentArtifactId: string;
    fileName: string;
    mimeType: string;
    sha256: string;
    bytes: Uint8Array;
    role?: string;
  }): Promise<{ uri: string }>;
  registerCase(restorationCase: RestorationCase): Promise<void>;\n  register(artifact: StoredRestorationArtifact): Promise<void>;
  get(ownerUserId: string, artifactId: string): Promise<StoredRestorationArtifact | undefined>;
}

export interface RestorationIngestResult {
  restorationCase: RestorationCase;
  artifact: StoredRestorationArtifact;
  source: RestorationRuntimeSource;
  fingerprint: AudioSourceFingerprint;
  probe: RestorationProbeReceipt;
}

function validateMimeType(mimeType: string): void {
  if (!AUDIO_MIME_TYPES.has(mimeType.toLowerCase())) {
    throw new Error(`Unsupported restoration audio MIME type: ${mimeType}`);
  }
}

function validateIdentity(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required.`);
  return trimmed;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", source);
  return toHex(new Uint8Array(digest));
}

function sourceArtifactId(caseId: string, sha256: string): string {
  return `music-source:${caseId}:${sha256.slice(0, 24)}`;
}

function sourceVersionTitle(fileName: string): string {
  const stripped = fileName.replace(/\.[^.]+$/, "").trim();
  return stripped || "Restoration source";
}

/**
 * MUSIC-RESTORE.1 ingest boundary.
 *
 * The original bytes are hashed before storage, written once to an immutable
 * source location, probed by the admitted audio runtime, then registered as
 * canonical source metadata. No decoded or repaired output can replace it.
 */
export async function ingestRestorationSource(input: {
  ownerUserId: string;
  caseId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  runtime: RestorationRuntimeClient;
  store: RestorationArtifactStore;
  now?: string;
}): Promise<RestorationIngestResult> {
  const ownerUserId = validateIdentity(input.ownerUserId, "Restoration owner user id");
  const caseId = validateIdentity(input.caseId, "Restoration case id");
  const fileName = validateIdentity(input.fileName, "Restoration source file name");
  validateMimeType(input.mimeType);

  if (!(input.bytes instanceof Uint8Array) || input.bytes.byteLength === 0) {
    throw new Error("Restoration source audio is empty.");
  }
  if (input.bytes.byteLength > MAX_RESTORATION_SOURCE_BYTES) {
    throw new Error("Restoration source audio exceeds the admitted size.");
  }

  const sha256 = await sha256Hex(input.bytes);
  const artifactId = sourceArtifactId(caseId, sha256);
  const existing = await input.store.get(ownerUserId, artifactId);
  if (existing) {
    if (existing.contentHash !== sha256 || existing.caseId !== caseId) {
      throw new Error("Existing restoration source artifact identity does not match the uploaded bytes.");
    }
    throw new Error("This immutable restoration source is already registered for the case.");
  }

  const stored = await input.store.putImmutableSource({
    ownerUserId,
    caseId,
    artifactId,
    fileName,
    mimeType: input.mimeType,
    sha256,
    bytes: input.bytes,
  });

  const source: RestorationRuntimeSource = {
    artifactId,
    uri: stored.runtimeUri,
    sha256,
    mimeType: input.mimeType,
  };
  const probe = await input.runtime.probe(source);
  if (probe.sourceSha256.toLowerCase() !== sha256.toLowerCase()) {
    throw new Error("Restoration runtime probe did not verify the canonical source hash.");
  }

  const now = input.now ?? new Date().toISOString();
  const artifact: StoredRestorationArtifact = {
    id: artifactId,
    kind: "source",
    contentHash: sha256,
    sampleRate: probe.sampleRate,
    channels: probe.channels,
    sampleCount: probe.sampleCount,
    createdAt: now,
    ownerUserId,
    caseId,
    storageUri: stored.storageUri,
    mimeType: input.mimeType,
    sizeBytes: input.bytes.byteLength,
    runtimeReceiptId: probe.runtimeReceiptId,
  };
  const restorationCase = createRestorationCase({
    id: caseId,
    userId: ownerUserId,
    title: sourceVersionTitle(fileName),
    sourceArtifactId: artifactId,
    now,
  });
  await input.store.registerCase(restorationCase);
  await input.store.register(artifact);

  const fingerprint: AudioSourceFingerprint = {
    assetId: artifactId,
    sha256,
    mimeType: input.mimeType,
    codec: probe.codec,
    sampleRateHz: probe.sampleRate,
    bitDepth: probe.bitDepth,
    channels: probe.channels,
    durationMs: Math.round(probe.durationSeconds * 1000),
    lossless: probe.lossless,
  };

  return { restorationCase, artifact, source, fingerprint, probe };
}
