import type { SupabaseClient } from "@supabase/supabase-js";
import {
  JHADINA_INTAKE_BUCKET,
  safeUploadFilename,
} from "./supabase-universal-upload-store";

export type DirectUploadGrant = {
  quarantinePath: string;
  token: string;
  signedUploadUrl?: string;
  tusEndpoint: string;
  chunkSizeBytes: number;
};

export type DirectUploadObjectInfo = {
  path: string;
  sizeBytes: number;
  mediaType: string;
};

const TUS_CHUNK_BYTES = 6 * 1024 * 1024;

export function supabaseTusEndpoint(projectUrl: string): string {
  const parsed = new URL(projectUrl);
  if (parsed.hostname.endsWith(".supabase.co")) {
    const projectRef = parsed.hostname.slice(0, -".supabase.co".length);
    if (!projectRef) throw new Error("DIRECT_UPLOAD_PROJECT_URL_INVALID");
    return `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
  }
  return `${parsed.origin}/storage/v1/upload/resumable`;
}

function splitObjectPath(path: string): { folder: string; filename: string } {
  const slash = path.lastIndexOf("/");
  return slash < 0
    ? { folder: "", filename: path }
    : { folder: path.slice(0, slash), filename: path.slice(slash + 1) };
}

export class SupabaseDirectUploadObjectStore {
  constructor(
    private readonly client: SupabaseClient,
    private readonly projectUrl: string,
    private readonly signedReadTtlSeconds = 300,
  ) {}

  async issue(input: {
    actorId: string;
    sessionId: string;
    filename: string;
  }): Promise<DirectUploadGrant> {
    if (!input.actorId.trim()) throw new Error("DIRECT_UPLOAD_ACTOR_REQUIRED");
    if (!input.sessionId.trim()) throw new Error("DIRECT_UPLOAD_SESSION_REQUIRED");
    const filename = safeUploadFilename(input.filename);
    const quarantinePath = `quarantine/${input.actorId}/${input.sessionId}/${filename}`;
    const { data, error } = await this.client.storage
      .from(JHADINA_INTAKE_BUCKET)
      .createSignedUploadUrl(quarantinePath);
    if (error || !data?.token) {
      throw error ?? new Error("DIRECT_UPLOAD_SIGNED_TOKEN_UNAVAILABLE");
    }

    return Object.freeze({
      quarantinePath,
      token: data.token,
      signedUploadUrl: "signedUrl" in data && typeof data.signedUrl === "string"
        ? data.signedUrl
        : undefined,
      tusEndpoint: supabaseTusEndpoint(this.projectUrl),
      chunkSizeBytes: TUS_CHUNK_BYTES,
    });
  }

  async inspect(quarantinePath: string): Promise<DirectUploadObjectInfo | undefined> {
    const { folder, filename } = splitObjectPath(quarantinePath);
    const { data, error } = await this.client.storage
      .from(JHADINA_INTAKE_BUCKET)
      .list(folder, { limit: 10, search: filename });
    if (error) throw error;
    const item = data?.find((entry) => entry.id !== null && entry.name === filename);
    if (!item) return undefined;

    const metadata = item.metadata as Record<string, unknown> | null | undefined;
    const rawSize = metadata?.size;
    const sizeBytes = typeof rawSize === "number"
      ? rawSize
      : typeof rawSize === "string"
        ? Number(rawSize)
        : NaN;
    const rawMime = metadata?.mimetype ?? metadata?.contentType ?? metadata?.["content-type"];
    if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
      throw new Error("DIRECT_UPLOAD_OBJECT_SIZE_UNAVAILABLE");
    }
    if (typeof rawMime !== "string" || !rawMime.trim()) {
      throw new Error("DIRECT_UPLOAD_OBJECT_MIME_UNAVAILABLE");
    }

    return Object.freeze({
      path: quarantinePath,
      sizeBytes,
      mediaType: rawMime.split(";")[0]!.trim().toLowerCase(),
    });
  }

  async scanUri(path: string): Promise<string> {
    const { data, error } = await this.client.storage
      .from(JHADINA_INTAKE_BUCKET)
      .createSignedUrl(path, this.signedReadTtlSeconds);
    if (error || !data?.signedUrl) {
      throw error ?? new Error("DIRECT_UPLOAD_SCAN_URL_UNAVAILABLE");
    }
    return data.signedUrl;
  }
}
