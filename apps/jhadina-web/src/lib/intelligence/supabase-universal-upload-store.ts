import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const JHADINA_INTAKE_BUCKET = "jhadina-intake-private";

export interface QuarantinedUpload {
  handle: string;
  scanUri: string;
}

export interface UniversalUploadObjectStore {
  putQuarantine(input: {
    actorId: string;
    filename: string;
    mediaType: string;
    bytes: Uint8Array;
  }): Promise<QuarantinedUpload>;
  promote(input: {
    actorId: string;
    quarantineHandle: string;
    filename: string;
  }): Promise<{ assetRef: string }>;
}

function safeFilename(value: string): string {
  const leaf = value.split(/[\\/]/).pop()?.trim() || "upload.bin";
  const safe = leaf.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return safe || "upload.bin";
}

export class SupabaseUniversalUploadObjectStore implements UniversalUploadObjectStore {
  constructor(
    private readonly client: SupabaseClient,
    private readonly signedUrlTtlSeconds = 300,
  ) {}

  async putQuarantine(input: {
    actorId: string;
    filename: string;
    mediaType: string;
    bytes: Uint8Array;
  }): Promise<QuarantinedUpload> {
    if (!input.actorId.trim()) throw new Error("UPLOAD_ACTOR_REQUIRED");
    const filename = safeFilename(input.filename);
    const attemptId = randomUUID();
    const path = `quarantine/${input.actorId}/${attemptId}/${filename}`;
    const bucket = this.client.storage.from(JHADINA_INTAKE_BUCKET);

    const { error: uploadError } = await bucket.upload(path, input.bytes, {
      contentType: input.mediaType,
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data, error: signedError } = await bucket.createSignedUrl(path, this.signedUrlTtlSeconds);
    if (signedError || !data?.signedUrl) {
      throw signedError ?? new Error("UPLOAD_SCAN_URL_UNAVAILABLE");
    }
    return Object.freeze({ handle: path, scanUri: data.signedUrl });
  }

  async promote(input: {
    actorId: string;
    quarantineHandle: string;
    filename: string;
  }): Promise<{ assetRef: string }> {
    const expectedPrefix = `quarantine/${input.actorId}/`;
    if (!input.quarantineHandle.startsWith(expectedPrefix)) {
      throw new Error("UPLOAD_QUARANTINE_SCOPE_MISMATCH");
    }

    const suffix = input.quarantineHandle.slice(expectedPrefix.length);
    const trustedPath = `trusted/${input.actorId}/${suffix}`;
    const bucket = this.client.storage.from(JHADINA_INTAKE_BUCKET);
    const { error } = await bucket.move(input.quarantineHandle, trustedPath);
    if (error) throw error;

    return Object.freeze({
      assetRef: `supabase://${JHADINA_INTAKE_BUCKET}/${trustedPath}`,
    });
  }
}
