"use client";

export type UploadSubsystemRoute = {
  subsystem: string;
  reason: string;
  confidence: number;
};

export type PerceptionJobView = {
  id: string;
  assetId?: string;
  status: "queued" | "running" | "retry_wait" | "needs_selection" | "completed" | "failed";
  attempt: number;
  maxAttempts: number;
  availableAt: string;
  lastError?: string;
  proposedRoutes?: UploadSubsystemRoute[];
  evidence?: Array<{ id: string; source: string; observedAt: string; summary: string }>;
  uncertainty?: string[];
  dispatch?: {
    assetId: string;
    responses: Array<{ subsystem: string; acceptedEvidenceIds: string[]; receiptId: string }>;
    skipped: string[];
  };
};

export type UniversalUploadProgress = {
  phase:
    | "preparing"
    | "uploading"
    | "paused"
    | "finalizing"
    | "processing"
    | "needs_selection"
    | "completed"
    | "failed";
  uploadedBytes: number;
  totalBytes: number;
  percent: number;
  sessionId?: string;
  job?: PerceptionJobView;
  message?: string;
};

export type UniversalUploadCallbacks = {
  onProgress?: (progress: UniversalUploadProgress) => void;
};

export type UniversalUploadTask = {
  readonly direct: boolean;
  pause(): void;
  resume(): Promise<void>;
  promise: Promise<PerceptionJobView>;
};

type SignedSessionResponse = {
  success: true;
  data: {
    session: {
      id: string;
      expiresAt: string;
    };
    upload: {
      path: string;
      token: string;
      resumable: {
        endpoint: string;
        headers: { "x-signature": string };
        chunkSizeBytes: number;
        metadata: Record<string, string>;
      };
    };
    finalizePath: string;
  };
};

const INLINE_UPLOAD_MAX_BYTES = 6 * 1024 * 1024;
const TUS_VERSION = "1.0.0";
const POLL_MIN_MS = 1500;
const POLL_MAX_MS = 5000;
const TUS_RETRY_DELAYS_MS = [0, 3000, 5000, 10000, 20000] as const;

const EXTENSION_MEDIA_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".js": "application/javascript",
  ".ts": "application/typescript",
});

export function effectiveUploadMediaType(file: Pick<File, "name" | "type">): string {
  const declared = file.type.split(";")[0]?.trim().toLowerCase();
  if (declared) return declared;
  const lower = file.name.toLowerCase();
  const extension = Object.keys(EXTENSION_MEDIA_TYPES)
    .sort((a, b) => b.length - a.length)
    .find((candidate) => lower.endsWith(candidate));
  return extension ? EXTENSION_MEDIA_TYPES[extension]! : "";
}

function clampPercent(uploaded: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((uploaded / total) * 100)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function encodeTusMetadata(metadata: Record<string, string>): string {
  return Object.entries(metadata)
    .map(([key, value]) => `${key} ${base64Utf8(value)}`)
    .join(",");
}

class TusPausedError extends Error {
  constructor() {
    super("TUS_UPLOAD_PAUSED");
  }
}

class SignedTusUploader {
  private paused = false;
  private abortController: AbortController | undefined;
  private uploadUrl: string | undefined;
  private lastOffset = 0;

  constructor(
    private readonly input: {
      sessionId: string;
      endpoint: string;
      signature: string;
      metadata: Record<string, string>;
      chunkSizeBytes: number;
      file: File;
    },
    private readonly callbacks: UniversalUploadCallbacks,
    private readonly fetchImpl: typeof fetch,
  ) {
    if (input.chunkSizeBytes !== 6 * 1024 * 1024) {
      throw new Error("TUS_CHUNK_SIZE_UNSUPPORTED");
    }
    this.uploadUrl = this.restoreUploadUrl();
  }

  pause(): void {
    this.paused = true;
    this.abortController?.abort();
    this.callbacks.onProgress?.({
      phase: "paused",
      uploadedBytes: this.lastOffset,
      totalBytes: this.input.file.size,
      percent: clampPercent(this.lastOffset, this.input.file.size),
      sessionId: this.input.sessionId,
    });
  }

  async upload(): Promise<void> {
    this.paused = false;
    const url = await this.ensureUploadUrl();
    let offset = await this.readOffset(url);

    while (offset < this.input.file.size) {
      if (this.paused) throw new TusPausedError();
      const next = Math.min(offset + this.input.chunkSizeBytes, this.input.file.size);
      const chunk = this.input.file.slice(offset, next);
      this.abortController = new AbortController();

      let response: Response | undefined;
      try {
        response = await this.fetchImpl(url, {
          method: "PATCH",
          headers: {
            "Tus-Resumable": TUS_VERSION,
            "Upload-Offset": String(offset),
            "Content-Type": "application/offset+octet-stream",
            "x-signature": this.input.signature,
          },
          body: chunk,
          signal: this.abortController.signal,
        });
      } catch (error) {
        if (this.paused) throw new TusPausedError();
        const reconciled = await this.reconcileAfterTransient(url, offset);
        if (reconciled !== undefined) {
          offset = reconciled;
          continue;
        }
        throw error;
      } finally {
        this.abortController = undefined;
      }

      if (response.status === 409) {
        const reconciled = await this.readOffset(url);
        if (reconciled < offset) throw new Error("TUS_OFFSET_REGRESSION");
        offset = reconciled;
        continue;
      }
      if (response.status >= 500) {
        const reconciled = await this.reconcileAfterTransient(url, offset);
        if (reconciled !== undefined) {
          offset = reconciled;
          continue;
        }
      }
      if (!response.ok) {
        throw new Error(`TUS_PATCH_HTTP_${response.status}`);
      }

      const header = response.headers.get("Upload-Offset");
      const acknowledged = header ? Number(header) : next;
      if (!Number.isInteger(acknowledged) || acknowledged < next || acknowledged > this.input.file.size) {
        throw new Error("TUS_OFFSET_INVALID");
      }
      offset = acknowledged;
      this.lastOffset = offset;
      this.callbacks.onProgress?.({
        phase: "uploading",
        uploadedBytes: offset,
        totalBytes: this.input.file.size,
        percent: clampPercent(offset, this.input.file.size),
        sessionId: this.input.sessionId,
      });
    }

    this.forgetUploadUrl();
  }

  private async ensureUploadUrl(): Promise<string> {
    if (this.uploadUrl) {
      try {
        await this.readOffset(this.uploadUrl);
        return this.uploadUrl;
      } catch {
        this.forgetUploadUrl();
        this.uploadUrl = undefined;
      }
    }

    const response = await this.fetchImpl(this.input.endpoint, {
      method: "POST",
      headers: {
        "Tus-Resumable": TUS_VERSION,
        "Upload-Length": String(this.input.file.size),
        "Upload-Metadata": encodeTusMetadata(this.input.metadata),
        "x-signature": this.input.signature,
      },
    });
    if (!response.ok) throw new Error(`TUS_CREATE_HTTP_${response.status}`);
    const location = response.headers.get("Location");
    if (!location) throw new Error("TUS_LOCATION_MISSING");
    this.uploadUrl = new URL(location, this.input.endpoint).toString();
    this.rememberUploadUrl(this.uploadUrl);
    return this.uploadUrl;
  }

  private async readOffset(url: string): Promise<number> {
    const response = await this.fetchImpl(url, {
      method: "HEAD",
      headers: {
        "Tus-Resumable": TUS_VERSION,
        "x-signature": this.input.signature,
      },
    });
    if (!response.ok) throw new Error(`TUS_HEAD_HTTP_${response.status}`);
    const raw = response.headers.get("Upload-Offset");
    const offset = raw === null ? 0 : Number(raw);
    if (!Number.isInteger(offset) || offset < 0 || offset > this.input.file.size) {
      throw new Error("TUS_OFFSET_INVALID");
    }
    this.lastOffset = offset;
    this.callbacks.onProgress?.({
      phase: "uploading",
      uploadedBytes: offset,
      totalBytes: this.input.file.size,
      percent: clampPercent(offset, this.input.file.size),
      sessionId: this.input.sessionId,
    });
    return offset;
  }

  private async reconcileAfterTransient(url: string, floorOffset: number): Promise<number | undefined> {
    for (const delay of TUS_RETRY_DELAYS_MS) {
      if (this.paused) throw new TusPausedError();
      if (delay > 0) await sleep(delay);
      try {
        const offset = await this.readOffset(url);
        if (offset < floorOffset) throw new Error("TUS_OFFSET_REGRESSION");
        return offset;
      } catch (error) {
        if (error instanceof TusPausedError) throw error;
      }
    }
    return undefined;
  }

  private storageKey(): string {
    return `jhadina:tus:${this.input.sessionId}:${this.input.file.name}:${this.input.file.size}:${this.input.file.lastModified}`;
  }

  private restoreUploadUrl(): string | undefined {
    if (typeof window === "undefined") return undefined;
    return window.localStorage.getItem(this.storageKey()) ?? undefined;
  }

  private rememberUploadUrl(url: string): void {
    if (typeof window !== "undefined") window.localStorage.setItem(this.storageKey(), url);
  }

  private forgetUploadUrl(): void {
    if (typeof window !== "undefined") window.localStorage.removeItem(this.storageKey());
  }
}

async function parseJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`HTTP_${response.status}_INVALID_JSON`);
  }
}

async function pollPerception(
  jobId: string,
  headers: Record<string, string>,
  callbacks: UniversalUploadCallbacks,
  fetchImpl: typeof fetch,
): Promise<PerceptionJobView> {
  let delay = POLL_MIN_MS;
  for (;;) {
    const response = await fetchImpl(`/api/jhadina/perception/${encodeURIComponent(jobId)}`, {
      headers,
      cache: "no-store",
    });
    const json = await parseJson(response);
    if (!response.ok) throw new Error(json.error || "PERCEPTION_STATUS_FAILED");
    const job = json.data as PerceptionJobView;

    callbacks.onProgress?.({
      phase: job.status === "needs_selection"
        ? "needs_selection"
        : job.status === "completed"
          ? "completed"
          : job.status === "failed"
            ? "failed"
            : "processing",
      uploadedBytes: 0,
      totalBytes: 0,
      percent: job.status === "completed" ? 100 : 0,
      job,
      message: job.lastError,
    });

    if (job.status === "completed" || job.status === "needs_selection") return job;
    if (job.status === "failed") throw new Error(job.lastError || "PERCEPTION_FAILED");

    await sleep(delay);
    delay = Math.min(POLL_MAX_MS, Math.round(delay * 1.35));
  }
}

async function inlineUpload(
  file: File,
  intent: string | undefined,
  privacyClass: "internal" | "sensitive" | "restricted",
  headers: Record<string, string>,
  callbacks: UniversalUploadCallbacks,
  fetchImpl: typeof fetch,
): Promise<PerceptionJobView> {
  const body = new FormData();
  body.append("file", file);
  body.append("privacyClass", privacyClass);
  if (intent?.trim()) body.append("intent", intent.trim());

  const result = await new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/jhadina/upload");
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      callbacks.onProgress?.({
        phase: "uploading",
        uploadedBytes: event.loaded,
        totalBytes: event.total,
        percent: clampPercent(event.loaded, event.total),
      });
    };
    xhr.onerror = () => reject(new Error("INLINE_UPLOAD_NETWORK_ERROR"));
    xhr.onload = () => {
      let json: any;
      try { json = JSON.parse(xhr.responseText || "{}"); }
      catch { reject(new Error(`INLINE_UPLOAD_HTTP_${xhr.status}_INVALID_JSON`)); return; }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(json.error || `INLINE_UPLOAD_HTTP_${xhr.status}`));
        return;
      }
      resolve(json.data);
    };
    xhr.send(body);
  });

  callbacks.onProgress?.({
    phase: "processing",
    uploadedBytes: file.size,
    totalBytes: file.size,
    percent: 100,
    job: result.perceptionJob,
  });
  return pollPerception(result.perceptionJob.id, headers, callbacks, fetchImpl);
}

export function createUniversalUploadTask(input: {
  file: File;
  intent?: string;
  privacyClass?: "internal" | "sensitive" | "restricted";
  userId?: string;
  callbacks?: UniversalUploadCallbacks;
  fetchImpl?: typeof fetch;
}): UniversalUploadTask {
  const callbacks = input.callbacks ?? {};
  const fetchImpl = input.fetchImpl ?? fetch;
  const privacyClass = input.privacyClass ?? "sensitive";
  const headers: Record<string, string> = input.userId
    ? { "x-jhadina-user-id": input.userId }
    : {};

  const mediaType = effectiveUploadMediaType(input.file);
  if (!mediaType) {
    const error = new Error("UPLOAD_TYPE_UNSUPPORTED");
    callbacks.onProgress?.({
      phase: "failed",
      uploadedBytes: 0,
      totalBytes: input.file.size,
      percent: 0,
      message: error.message,
    });
    return {
      direct: input.file.size > INLINE_UPLOAD_MAX_BYTES,
      pause() {},
      async resume() {},
      promise: Promise.reject(error),
    };
  }

  const normalizedFile = input.file.type
    ? input.file
    : new File([input.file], input.file.name, {
        type: mediaType,
        lastModified: input.file.lastModified,
      });

  if (normalizedFile.size <= INLINE_UPLOAD_MAX_BYTES) {
    const promise = inlineUpload(normalizedFile, input.intent, privacyClass, headers, callbacks, fetchImpl);
    return {
      direct: false,
      pause() {},
      async resume() {},
      promise,
    };
  }

  let uploader: SignedTusUploader | undefined;
  let resumeResolver: (() => void) | undefined;
  let resumeRejecter: ((error: unknown) => void) | undefined;
  let running = false;

  const promise = (async (): Promise<PerceptionJobView> => {
    callbacks.onProgress?.({
      phase: "preparing",
      uploadedBytes: 0,
      totalBytes: normalizedFile.size,
      percent: 0,
    });

    const issue = await fetchImpl("/api/jhadina/upload/session", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({
        filename: normalizedFile.name,
        mediaType,
        byteLength: normalizedFile.size,
        privacyClass,
        intent: input.intent?.trim() || undefined,
      }),
    });
    const issueJson = await parseJson(issue);
    if (!issue.ok) throw new Error(issueJson.error || "DIRECT_UPLOAD_SESSION_FAILED");

    const data = (issueJson as SignedSessionResponse).data;
    uploader = new SignedTusUploader({
      sessionId: data.session.id,
      endpoint: data.upload.resumable.endpoint,
      signature: data.upload.resumable.headers["x-signature"],
      metadata: data.upload.resumable.metadata,
      chunkSizeBytes: data.upload.resumable.chunkSizeBytes,
      file: normalizedFile,
    }, callbacks, fetchImpl);

    for (;;) {
      try {
        running = true;
        await uploader.upload();
        running = false;
        break;
      } catch (error) {
        running = false;
        if (!(error instanceof TusPausedError)) throw error;
        await new Promise<void>((resolve, reject) => {
          resumeResolver = resolve;
          resumeRejecter = reject;
        });
        resumeResolver = undefined;
        resumeRejecter = undefined;
      }
    }

    callbacks.onProgress?.({
      phase: "finalizing",
      uploadedBytes: normalizedFile.size,
      totalBytes: normalizedFile.size,
      percent: 100,
      sessionId: data.session.id,
    });

    const finalized = await fetchImpl(data.finalizePath, {
      method: "POST",
      headers,
    });
    const finalizedJson = await parseJson(finalized);
    if (!finalized.ok) throw new Error(finalizedJson.error || "DIRECT_UPLOAD_FINALIZE_FAILED");
    const job = finalizedJson.data.perceptionJob as PerceptionJobView;

    callbacks.onProgress?.({
      phase: "processing",
      uploadedBytes: normalizedFile.size,
      totalBytes: normalizedFile.size,
      percent: 100,
      sessionId: data.session.id,
      job,
    });
    return pollPerception(job.id, headers, callbacks, fetchImpl);
  })();

  return {
    direct: true,
    pause() {
      if (running) uploader?.pause();
    },
    async resume() {
      resumeResolver?.();
    },
    promise: promise.catch((error) => {
      resumeRejecter?.(error);
      callbacks.onProgress?.({
        phase: "failed",
        uploadedBytes: 0,
        totalBytes: normalizedFile.size,
        percent: 0,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }),
  };
}

export async function selectPerceptionSubsystems(input: {
  jobId: string;
  subsystems: string[];
  userId?: string;
  callbacks?: UniversalUploadCallbacks;
  fetchImpl?: typeof fetch;
}): Promise<PerceptionJobView> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(input.userId ? { "x-jhadina-user-id": input.userId } : {}),
  };
  const response = await fetchImpl(`/api/jhadina/perception/${encodeURIComponent(input.jobId)}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ subsystems: input.subsystems }),
  });
  const json = await parseJson(response);
  if (!response.ok) throw new Error(json.error || "PERCEPTION_SELECTION_FAILED");

  const pollingHeaders = input.userId ? { "x-jhadina-user-id": input.userId } : {};
  return pollPerception(input.jobId, pollingHeaders, input.callbacks ?? {}, fetchImpl);
}
