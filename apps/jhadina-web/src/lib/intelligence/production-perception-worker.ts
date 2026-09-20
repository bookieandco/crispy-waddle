import type {
  MediaExtractionBackend,
  MediaExtractionObservation,
  MediaExtractionRequest,
} from "@jhadina/intelligence-core";
import type { TrustedAssetReadResolver } from "./trusted-asset-read-resolver";

export type PerceptionWorkerOperation =
  | "video.frames"
  | "video.scenes"
  | "audio.transcript"
  | "audio.beats"
  | "audio.features"
  | "document.text"
  | "document.pages"
  | "document.tables"
  | "document.ocr"
  | "image.vision"
  | "image.ocr"
  | "text.chunks"
  | "code.text"
  | "code.structure";

export interface PerceptionWorkerResult {
  schema: "jhadina.perception-result.v1";
  assetId: string;
  contentSha256?: string;
  observations: readonly MediaExtractionObservation[];
  uncertainty?: readonly string[];
}

const OPS: Readonly<Record<MediaExtractionRequest["modality"], readonly PerceptionWorkerOperation[]>> =
  Object.freeze({
    video: Object.freeze(["video.frames", "video.scenes", "audio.transcript", "audio.features"]),
    audio: Object.freeze(["audio.transcript", "audio.beats", "audio.features"]),
    image: Object.freeze(["image.vision", "image.ocr"]),
    document: Object.freeze(["document.text", "document.pages", "document.tables", "document.ocr"]),
    text: Object.freeze(["text.chunks"]),
    code: Object.freeze(["code.text", "code.structure"]),
  });

const PRIVACY_RANK = { public: 0, internal: 1, sensitive: 2, restricted: 3 } as const;
const MAX_OBSERVATIONS = 1000;
const MAX_SUMMARY_CHARS = 16000;
const MAX_UNCERTAINTY = 100;
const MAX_UNCERTAINTY_CHARS = 2000;

export class HttpSemanticPerceptionBackend implements MediaExtractionBackend {
  constructor(
    private readonly endpoint: string,
    private readonly resolver: TrustedAssetReadResolver,
    private readonly token?: string,
    private readonly privacyCeiling: keyof typeof PRIVACY_RANK = "sensitive",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!endpoint.trim()) throw new Error("PERCEPTION_WORKER_ENDPOINT_REQUIRED");
  }

  async extract(input: MediaExtractionRequest) {
    if (PRIVACY_RANK[input.privacyClass] > PRIVACY_RANK[this.privacyCeiling]) {
      throw new Error("PERCEPTION_WORKER_PRIVACY_INCOMPATIBLE");
    }

    const signedUri = await this.resolver.signedReadUrl({
      actorId: input.actorId,
      assetRef: input.assetRef,
    });

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify({
        schema: "jhadina.perception-job.v1",
        asset: {
          id: input.assetId,
          modality: input.modality,
          mediaType: input.mediaType,
          uri: signedUri,
          contentSha256: input.contentSha256 ?? null,
          byteLength: input.byteLength ?? null,
        },
        segment: input.segment ?? null,
        operations: OPS[input.modality],
      }),
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`PERCEPTION_WORKER_HTTP_${response.status}`);
    const raw = await response.json() as Partial<PerceptionWorkerResult>;

    if (raw.schema !== "jhadina.perception-result.v1") throw new Error("PERCEPTION_WORKER_SCHEMA_INVALID");
    if (raw.assetId !== input.assetId) throw new Error("PERCEPTION_WORKER_ASSET_MISMATCH");
    if (input.contentSha256 && typeof raw.contentSha256 !== "string") {
      throw new Error("PERCEPTION_WORKER_HASH_REQUIRED");
    }
    if (
      input.contentSha256 &&
      raw.contentSha256!.toLowerCase() !== input.contentSha256.toLowerCase()
    ) throw new Error("PERCEPTION_WORKER_HASH_MISMATCH");
    if (!Array.isArray(raw.observations)) throw new Error("PERCEPTION_WORKER_OBSERVATIONS_INVALID");
    if (raw.observations.length > MAX_OBSERVATIONS) throw new Error("PERCEPTION_WORKER_OBSERVATION_LIMIT_EXCEEDED");

    const observations = raw.observations.map((observation) => validateObservation(observation));
    const uncertainty = raw.uncertainty ?? [];
    if (!Array.isArray(uncertainty) || uncertainty.length > MAX_UNCERTAINTY) {
      throw new Error("PERCEPTION_WORKER_UNCERTAINTY_INVALID");
    }
    for (const item of uncertainty) {
      if (typeof item !== "string" || item.length > MAX_UNCERTAINTY_CHARS) {
        throw new Error("PERCEPTION_WORKER_UNCERTAINTY_INVALID");
      }
    }

    return Object.freeze({
      observations: Object.freeze(observations),
      uncertainty: Object.freeze([...uncertainty]),
    });
  }
}

function validateObservation(value: unknown): MediaExtractionObservation {
  if (!value || typeof value !== "object") throw new Error("PERCEPTION_WORKER_OBSERVATION_INVALID");
  const observation = value as Record<string, unknown>;
  if (
    typeof observation.kind !== "string" ||
    !/^[a-z0-9][a-z0-9._:-]{0,127}$/i.test(observation.kind)
  ) throw new Error("PERCEPTION_WORKER_OBSERVATION_KIND_INVALID");
  if (typeof observation.summary !== "string" || !observation.summary.trim()) {
    throw new Error("PERCEPTION_WORKER_OBSERVATION_SUMMARY_INVALID");
  }
  if (observation.summary.length > MAX_SUMMARY_CHARS) {
    throw new Error("PERCEPTION_WORKER_OBSERVATION_SUMMARY_TOO_LARGE");
  }
  if (
    observation.observedAt !== undefined &&
    (typeof observation.observedAt !== "string" || Number.isNaN(Date.parse(observation.observedAt)))
  ) throw new Error("PERCEPTION_WORKER_OBSERVATION_TIMESTAMP_INVALID");

  return Object.freeze({
    kind: observation.kind,
    summary: `[UNTRUSTED_ASSET_CONTENT] ${observation.summary.trim()}`,
    observedAt: observation.observedAt as string | undefined,
  });
}

export function perceptionOperationsFor(
  modality: MediaExtractionRequest["modality"],
): readonly PerceptionWorkerOperation[] {
  return OPS[modality];
}
