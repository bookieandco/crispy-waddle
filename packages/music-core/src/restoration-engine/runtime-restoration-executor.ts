import type { RestorationCandidate } from "./types.js";
import type {
  RestorationExecutionAuthorization,
  RestorationExecutor,
} from "./execution-authorization.js";
import type {
  RestorationArtifactWriter,
} from "./verified-execution.js";
import {
  sha256Hex,
  type RestorationArtifactStore,
  type StoredRestorationArtifact,
} from "./ingest-runtime.js";
import type {
  RestorationRepairOperation,
  RestorationRuntimeClient,
  RestorationRuntimeSource,
} from "./runtime-contract.js";
import type { MusicArtifact } from "./provenance-ledger.js";

const REPAIR_OPERATIONS = new Set<RestorationRepairOperation>([
  "copy",
  "gain",
  "eq",
  "declick",
  "declip",
  "denoise",
]);

function admittedRepairOperation(operation: string): RestorationRepairOperation {
  if (!REPAIR_OPERATIONS.has(operation as RestorationRepairOperation)) {
    throw new Error(`Restoration operation is not implemented by the production repair executor: ${operation}`);
  }
  return operation as RestorationRepairOperation;
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "repair";
}

export interface RuntimeRestorationWriterContext {
  ownerUserId: string;
  caseId: string;
  executionId: string;
  candidate: RestorationCandidate;
  source: StoredRestorationArtifact;
  runtime: RestorationRuntimeClient;
  store: RestorationArtifactStore;
  now?: string;
}

/**
 * MUSIC-RESTORE.4 concrete artifact writer.
 *
 * It accepts only an already-authorized candidate, sends a typed repair request
 * to the admitted worker, independently verifies the returned bytes/hash, and
 * durably registers the derived WAV before verified-execution can promote it.
 */
export class RuntimeRestorationArtifactWriter implements RestorationArtifactWriter {
  constructor(private readonly context: RuntimeRestorationWriterContext) {}

  async write(input: {
    authorization: RestorationExecutionAuthorization;
  }): Promise<MusicArtifact> {
    const { authorization } = input;
    const {
      ownerUserId,
      caseId,
      executionId,
      candidate,
      source,
      runtime,
      store,
    } = this.context;

    if (!authorization.authorized) throw new Error("Runtime restoration writer requires an authorized execution.");
    if (authorization.candidateId !== candidate.id) throw new Error("Runtime restoration candidate mismatch.");
    if (authorization.sourceArtifactId !== source.id || candidate.inputArtifactId !== source.id) {
      throw new Error("Runtime restoration source lineage mismatch.");
    }
    if (source.ownerUserId !== ownerUserId || source.caseId !== caseId) {
      throw new Error("Runtime restoration source ownership/case mismatch.");
    }

    const operation = admittedRepairOperation(candidate.operation);
    const runtimeUri = await store.resolveRuntimeUri(ownerUserId, source.id);
    const runtimeSource: RestorationRuntimeSource = {
      artifactId: source.id,
      uri: runtimeUri,
      sha256: source.contentHash,
      mimeType: source.mimeType,
    };
    const receipt = await runtime.execute({
      executionId,
      authorizationId: authorization.id,
      source: runtimeSource,
      operation,
      parameters: { ...candidate.parameters },
      sampleRate: source.sampleRate,
      channels: source.channels,
    });

    if (receipt.operation !== operation) throw new Error("Restoration runtime executed a different operation.");
    if (receipt.sourceArtifactId !== source.id) throw new Error("Restoration runtime output lineage mismatch.");
    if (receipt.sampleRate !== source.sampleRate || receipt.channels !== source.channels) {
      throw new Error("Restoration runtime changed source signal dimensions without authorization.");
    }

    const bytes = await runtime.downloadArtifact(receipt.resultUri);
    if (!bytes.byteLength) throw new Error("Restoration runtime returned an empty output artifact.");
    const actualSha256 = await sha256Hex(bytes);
    if (actualSha256.toLowerCase() !== receipt.outputSha256.toLowerCase()) {
      throw new Error("Restoration runtime output hash mismatch.");
    }
    const existing = await store.get(ownerUserId, receipt.outputArtifactId);
    if (existing) throw new Error(`Restoration output artifact already exists: ${receipt.outputArtifactId}`);

    const stored = await store.putDerived({
      ownerUserId,
      caseId,
      artifactId: receipt.outputArtifactId,
      parentArtifactId: source.id,
      fileName: `${safeFilePart(operation)}-${safeFilePart(executionId)}.wav`,
      mimeType: "audio/wav",
      sha256: actualSha256,
      bytes,
      role: "restoration-output",
    });

    const artifact: StoredRestorationArtifact = {
      id: receipt.outputArtifactId,
      kind: candidate.provenance === "reconstructed" ? "reconstructed" : "derived",
      contentHash: actualSha256,
      sampleRate: receipt.sampleRate,
      channels: receipt.channels,
      sampleCount: receipt.sampleCount,
      parentArtifactId: source.id,
      createdAt: this.context.now ?? new Date().toISOString(),
      ownerUserId,
      caseId,
      storageUri: stored.storageUri,
      mimeType: "audio/wav",
      sizeBytes: bytes.byteLength,
      runtimeReceiptId: receipt.runtimeReceiptId,
    };
    await store.register(artifact);
    return artifact;
  }
}

/** Compatibility adapter for callers that still use executeAuthorizedRestoration. */
export class RuntimeRestorationExecutor implements RestorationExecutor {
  constructor(private readonly writer: RuntimeRestorationArtifactWriter) {}

  async execute(authorization: RestorationExecutionAuthorization): Promise<{ outputArtifactId: string }> {
    const artifact = await this.writer.write({ authorization });
    return { outputArtifactId: artifact.id };
  }
}
