import "server-only";

import type {
  TikTokCommercialQcResult,
} from "@jhadina/director-core";

export type TikTokCommercialCreativeProviderKind =
  | "local_worker"
  | "runpod_serverless";

export type TikTokCommercialCreativeRequest = {
  jobId: string;
  projectId: string;
  productRef: string;
  qc: TikTokCommercialQcResult;
  prompt: string;
  referenceAssetUris: readonly string[];
  durationSeconds: number;
  aspectRatio: "9:16" | "1:1" | "4:5";
  seed?: number;
  maxCostUsd?: number;
  evidenceRefs: readonly string[];
};

export type TikTokCommercialCreativeReceipt = {
  jobId: string;
  projectId: string;
  productRef: string;
  providerKind: TikTokCommercialCreativeProviderKind;
  providerJobId: string;
  status: "queued" | "processing" | "ready" | "failed";
  artifactUri?: string;
  costUsd?: number;
  error?: string;
  evidenceRefs: readonly string[];
  observedAt: string;
  publicationAuthority: "NO_PUBLISH_AUTHORITY";
  moneyMovementAuthorized: false;
};

export type TikTokCommercialCreativeExecutor = {
  kind: TikTokCommercialCreativeProviderKind;
  execute(
    request: TikTokCommercialCreativeRequest,
  ): Promise<TikTokCommercialCreativeReceipt>;
};

export function resolveTikTokCommercialCreativeExecutor(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): TikTokCommercialCreativeExecutor | undefined {
  const localUrl = env.TIKTOK_COMMERCIAL_LOCAL_WORKER_URL?.trim();
  if (localUrl) {
    return createLocalWorkerExecutor({
      baseUrl: localUrl,
      token: env.TIKTOK_COMMERCIAL_LOCAL_WORKER_TOKEN?.trim(),
      fetchImpl,
    });
  }

  const endpointId = env.TIKTOK_COMMERCIAL_RUNPOD_ENDPOINT_ID?.trim();
  const apiKey =
    env.RUNPOD_API_KEY?.trim() ||
    env.RUNPOD_KEY?.trim() ||
    env.runpod_key?.trim();
  if (endpointId && apiKey) {
    return createRunpodServerlessExecutor({
      endpointId,
      apiKey,
      fetchImpl,
    });
  }

  return undefined;
}

export function createLocalWorkerExecutor(input: {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
}): TikTokCommercialCreativeExecutor {
  const baseUrl = normalizeHttpsBaseUrl(
    input.baseUrl,
    "TIKTOK_COMMERCIAL_LOCAL_WORKER_URL_INVALID",
  );
  const fetchImpl = input.fetchImpl ?? fetch;
  return {
    kind: "local_worker",
    async execute(request) {
      validateRequest(request);
      const response = await fetchImpl(`${baseUrl}/v1/jobs`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": request.jobId,
          ...(input.token ? { authorization: `Bearer ${input.token}` } : {}),
        },
        body: JSON.stringify({
          request: providerPayload(request),
        }),
        cache: "no-store",
      });
      const bodyText = await response.text();
      if (!response.ok) {
        return failedReceipt(
          request,
          "local_worker",
          request.jobId,
          `LOCAL_WORKER_HTTP_${response.status}:${safeMessage(bodyText)}`,
        );
      }
      const body = parseRecord(bodyText);
      const providerJobId =
        stringValue(body.providerJobId) ??
        stringValue(body.id) ??
        request.jobId;
      const status = normalizeProviderStatus(body.status);
      const artifactUri =
        stringValue(body.resultUri) ??
        stringValue(body.artifactUri) ??
        stringValue(body.outputUrl);
      return Object.freeze({
        jobId: request.jobId,
        projectId: request.projectId,
        productRef: request.productRef,
        providerKind: "local_worker" as const,
        providerJobId,
        status,
        artifactUri,
        costUsd: finiteNumber(body.costUsd),
        error: stringValue(body.error),
        evidenceRefs: Object.freeze(unique([
          ...request.evidenceRefs,
          `director:commercial-job:${providerJobId}`,
        ])),
        observedAt: new Date().toISOString(),
        publicationAuthority: "NO_PUBLISH_AUTHORITY" as const,
        moneyMovementAuthorized: false as const,
      });
    },
  };
}

export function createRunpodServerlessExecutor(input: {
  endpointId: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}): TikTokCommercialCreativeExecutor {
  const endpointId = requireText(
    input.endpointId,
    "TIKTOK_COMMERCIAL_RUNPOD_ENDPOINT_REQUIRED",
  );
  const apiKey = requireText(
    input.apiKey,
    "TIKTOK_COMMERCIAL_RUNPOD_KEY_REQUIRED",
  );
  const baseUrl = normalizeHttpsBaseUrl(
    input.baseUrl ?? "https://api.runpod.ai",
    "TIKTOK_COMMERCIAL_RUNPOD_BASE_URL_INVALID",
  );
  const fetchImpl = input.fetchImpl ?? fetch;

  return {
    kind: "runpod_serverless",
    async execute(request) {
      validateRequest(request);
      const response = await fetchImpl(
        `${baseUrl}/v2/${encodeURIComponent(endpointId)}/runsync`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            input: providerPayload(request),
            policy: {
              executionTimeout: 600000,
            },
          }),
          cache: "no-store",
        },
      );
      const bodyText = await response.text();
      if (!response.ok) {
        return failedReceipt(
          request,
          "runpod_serverless",
          request.jobId,
          `RUNPOD_HTTP_${response.status}:${safeMessage(bodyText)}`,
        );
      }
      const body = parseRecord(bodyText);
      const providerJobId =
        stringValue(body.id) ??
        stringValue(body.jobId) ??
        request.jobId;
      const output = isRecord(body.output) ? body.output : {};
      const status = normalizeRunpodStatus(body.status);
      const artifactUri =
        stringValue(output.assetUri) ??
        stringValue(output.artifactUri) ??
        stringValue(output.resultUri) ??
        stringValue(output.outputUrl);
      return Object.freeze({
        jobId: request.jobId,
        projectId: request.projectId,
        productRef: request.productRef,
        providerKind: "runpod_serverless" as const,
        providerJobId,
        status,
        artifactUri,
        costUsd:
          finiteNumber(body.costUsd) ??
          finiteNumber(output.costUsd),
        error:
          stringValue(body.error) ??
          stringValue(output.error),
        evidenceRefs: Object.freeze(unique([
          ...request.evidenceRefs,
          `runpod:endpoint:${endpointId}`,
          `runpod:job:${providerJobId}`,
        ])),
        observedAt: new Date().toISOString(),
        publicationAuthority: "NO_PUBLISH_AUTHORITY" as const,
        moneyMovementAuthorized: false as const,
      });
    },
  };
}

function validateRequest(request: TikTokCommercialCreativeRequest): void {
  requireText(request.jobId, "TIKTOK_COMMERCIAL_JOB_ID_REQUIRED");
  requireText(request.projectId, "TIKTOK_COMMERCIAL_PROJECT_ID_REQUIRED");
  requireText(request.productRef, "TIKTOK_COMMERCIAL_PRODUCT_REQUIRED");
  requireText(request.prompt, "TIKTOK_COMMERCIAL_PROMPT_REQUIRED");

  if (
    request.qc.status !== "pass" ||
    request.qc.productRef !== request.productRef
  ) {
    throw new Error("TIKTOK_COMMERCIAL_QC_PASS_REQUIRED");
  }
  if (!request.referenceAssetUris.length) {
    throw new Error("TIKTOK_COMMERCIAL_REFERENCE_ASSETS_REQUIRED");
  }
  if (!request.evidenceRefs.length) {
    throw new Error("TIKTOK_COMMERCIAL_EVIDENCE_REQUIRED");
  }
  if (
    !Number.isFinite(request.durationSeconds) ||
    request.durationSeconds <= 0 ||
    request.durationSeconds > 60
  ) {
    throw new Error("TIKTOK_COMMERCIAL_DURATION_INVALID");
  }
  if (
    request.maxCostUsd !== undefined &&
    (!Number.isFinite(request.maxCostUsd) || request.maxCostUsd < 0)
  ) {
    throw new Error("TIKTOK_COMMERCIAL_COST_CAP_INVALID");
  }
}

function providerPayload(
  request: TikTokCommercialCreativeRequest,
): Record<string, unknown> {
  return {
    jobId: request.jobId,
    projectId: request.projectId,
    productRef: request.productRef,
    prompt: request.prompt,
    referenceAssetUris: [...request.referenceAssetUris],
    durationSeconds: request.durationSeconds,
    aspectRatio: request.aspectRatio,
    ...(request.seed !== undefined ? { seed: request.seed } : {}),
    ...(request.maxCostUsd !== undefined
      ? { maxCostUsd: request.maxCostUsd }
      : {}),
    qc: {
      id: request.qc.id,
      evidenceIds: [...request.qc.evidenceIds],
      approvedClaimRefs: [...request.qc.approvedClaimRefs],
      approvedOfferRefs: [...request.qc.approvedOfferRefs],
    },
    publicationAuthority: "NO_PUBLISH_AUTHORITY",
  };
}

function failedReceipt(
  request: TikTokCommercialCreativeRequest,
  providerKind: TikTokCommercialCreativeProviderKind,
  providerJobId: string,
  error: string,
): TikTokCommercialCreativeReceipt {
  return Object.freeze({
    jobId: request.jobId,
    projectId: request.projectId,
    productRef: request.productRef,
    providerKind,
    providerJobId,
    status: "failed" as const,
    error,
    evidenceRefs: Object.freeze([...request.evidenceRefs]),
    observedAt: new Date().toISOString(),
    publicationAuthority: "NO_PUBLISH_AUTHORITY" as const,
    moneyMovementAuthorized: false as const,
  });
}

function normalizeProviderStatus(
  value: unknown,
): TikTokCommercialCreativeReceipt["status"] {
  const normalized = String(value ?? "").toLowerCase();
  if (["ready", "completed", "succeeded", "success"].includes(normalized)) {
    return "ready";
  }
  if (["failed", "error", "cancelled", "canceled"].includes(normalized)) {
    return "failed";
  }
  if (["queued", "pending"].includes(normalized)) return "queued";
  return "processing";
}

function normalizeRunpodStatus(
  value: unknown,
): TikTokCommercialCreativeReceipt["status"] {
  const normalized = String(value ?? "").toUpperCase();
  if (["COMPLETED", "READY"].includes(normalized)) return "ready";
  if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(normalized)) return "failed";
  if (["IN_QUEUE", "QUEUED"].includes(normalized)) return "queued";
  return "processing";
}

function normalizeHttpsBaseUrl(value: string, code: string): string {
  const url = new URL(value.trim());
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname))
  ) {
    throw new Error(code);
  }
  return url.toString().replace(/\/+$/, "");
}

function requireText(value: string, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function parseRecord(text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  const value = JSON.parse(text) as unknown;
  if (!isRecord(value)) throw new Error("TIKTOK_COMMERCIAL_PROVIDER_RESPONSE_INVALID");
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function safeMessage(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").slice(0, 300);
}
