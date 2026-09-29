import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RestorationArtifactStore,
  RestorationCase,
  StoredRestorationArtifact,
} from "@jhadina/music-core";

const BUCKET = "jhadina-music-restoration";
const SIGNED_URL_TTL_SECONDS = 10 * 60;

function safePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "artifact";
}

function sourcePath(input: {
  ownerUserId: string;
  caseId: string;
  sha256: string;
  fileName: string;
}): string {
  return [
    safePart(input.ownerUserId),
    safePart(input.caseId),
    "source",
    input.sha256.toLowerCase(),
    safePart(input.fileName),
  ].join("/");
}

function derivedPath(input: {
  ownerUserId: string;
  caseId: string;
  artifactId: string;
  sha256: string;
  fileName: string;
}): string {
  return [
    safePart(input.ownerUserId),
    safePart(input.caseId),
    "derived",
    safePart(input.artifactId),
    input.sha256.toLowerCase(),
    safePart(input.fileName),
  ].join("/");
}

export class SupabaseMusicRestorationArtifactStore implements RestorationArtifactStore {
  constructor(
    private readonly client: SupabaseClient,
    private readonly ownerUserId: string,
  ) {}

  async putImmutableSource(input: {
    ownerUserId: string;
    caseId: string;
    artifactId: string;
    fileName: string;
    mimeType: string;
    sha256: string;
    bytes: Uint8Array;
  }): Promise<{ storageUri: string; runtimeUri: string }> {
    this.assertOwner(input.ownerUserId);
    const path = sourcePath(input);
    const { error } = await this.client.storage
      .from(BUCKET)
      .upload(path, input.bytes, {
        contentType: input.mimeType,
        upsert: false,
        cacheControl: "31536000",
      });
    if (error) throw new Error(`MUSIC_RESTORATION_SOURCE_UPLOAD_FAILED: ${error.message}`);
    return {
      storageUri: `supabase-private://${BUCKET}/${path}`,
      runtimeUri: await this.signedUrl(path),
    };
  }

  async putDerived(input: {
    ownerUserId: string;
    caseId: string;
    artifactId: string;
    parentArtifactId: string;
    fileName: string;
    mimeType: string;
    sha256: string;
    bytes: Uint8Array;
    role?: string;
  }): Promise<{ storageUri: string; runtimeUri: string }> {
    this.assertOwner(input.ownerUserId);
    if (!input.parentArtifactId.trim()) throw new Error("MUSIC_RESTORATION_PARENT_ARTIFACT_REQUIRED");
    const path = derivedPath(input);
    const { error } = await this.client.storage
      .from(BUCKET)
      .upload(path, input.bytes, {
        contentType: input.mimeType,
        upsert: false,
        cacheControl: "31536000",
      });
    if (error) throw new Error(`MUSIC_RESTORATION_DERIVED_UPLOAD_FAILED: ${error.message}`);
    return {
      storageUri: `supabase-private://${BUCKET}/${path}`,
      runtimeUri: await this.signedUrl(path),
    };
  }

  async resolveRuntimeUri(ownerUserId: string, artifactId: string): Promise<string> {
    this.assertOwner(ownerUserId);
    const { data, error } = await this.client
      .from("music_restoration_artifacts")
      .select("storage_bucket,storage_path")
      .eq("id", artifactId)
      .eq("owner_user_id", this.ownerUserId)
      .single();
    if (error || !data) throw new Error(`MUSIC_RESTORATION_ARTIFACT_LOOKUP_FAILED: ${error?.message ?? "not found"}`);
    if (data.storage_bucket !== BUCKET) throw new Error("MUSIC_RESTORATION_ARTIFACT_BUCKET_NOT_ADMITTED");
    return this.signedUrl(String(data.storage_path));
  }

  async registerCase(restorationCase: RestorationCase): Promise<void> {
    this.assertOwner(restorationCase.userId);
    const { error } = await this.client.from("music_restoration_cases").insert({
      id: restorationCase.id,
      user_id: restorationCase.userId,
      title: restorationCase.title,
      status: restorationCase.status,
      source_artifact_id: restorationCase.versions[0]?.outputArtifactId ?? "",
      source_version_id: restorationCase.sourceVersionId,
      current_version_id: restorationCase.currentVersionId,
      created_at: restorationCase.createdAt,
      updated_at: restorationCase.updatedAt,
    });
    if (error) throw new Error(`MUSIC_RESTORATION_CASE_WRITE_FAILED: ${error.message}`);
  }

  async register(artifact: StoredRestorationArtifact): Promise<void> {
    this.assertOwner(artifact.ownerUserId);
    const parsed = this.parseStorageUri(artifact.storageUri);
    const { error } = await this.client.from("music_restoration_artifacts").insert({
      id: artifact.id,
      case_id: artifact.caseId,
      owner_user_id: artifact.ownerUserId,
      kind: artifact.kind,
      content_hash: artifact.contentHash.toLowerCase(),
      sample_rate: artifact.sampleRate,
      channels: artifact.channels,
      sample_count: artifact.sampleCount,
      parent_artifact_id: artifact.parentArtifactId ?? null,
      storage_bucket: parsed.bucket,
      storage_path: parsed.path,
      mime_type: artifact.mimeType,
      size_bytes: artifact.sizeBytes,
      role: artifact.role ?? null,
      runtime_receipt_id: artifact.runtimeReceiptId ?? null,
      created_at: artifact.createdAt,
    });
    if (error) throw new Error(`MUSIC_RESTORATION_ARTIFACT_WRITE_FAILED: ${error.message}`);
  }

  async get(ownerUserId: string, artifactId: string): Promise<StoredRestorationArtifact | undefined> {
    this.assertOwner(ownerUserId);
    const { data, error } = await this.client
      .from("music_restoration_artifacts")
      .select("*")
      .eq("id", artifactId)
      .eq("owner_user_id", this.ownerUserId)
      .maybeSingle();
    if (error) throw new Error(`MUSIC_RESTORATION_ARTIFACT_READ_FAILED: ${error.message}`);
    if (!data) return undefined;
    return {
      id: String(data.id),
      kind: data.kind,
      contentHash: String(data.content_hash),
      sampleRate: Number(data.sample_rate),
      channels: Number(data.channels),
      sampleCount: Number(data.sample_count),
      parentArtifactId: data.parent_artifact_id ? String(data.parent_artifact_id) : undefined,
      createdAt: String(data.created_at),
      ownerUserId: String(data.owner_user_id),
      caseId: String(data.case_id),
      storageUri: `supabase-private://${String(data.storage_bucket)}/${String(data.storage_path)}`,
      mimeType: String(data.mime_type),
      sizeBytes: Number(data.size_bytes),
      role: data.role ? String(data.role) : undefined,
      runtimeReceiptId: data.runtime_receipt_id ? String(data.runtime_receipt_id) : undefined,
    };
  }

  private assertOwner(ownerUserId: string): void {
    if (!ownerUserId || ownerUserId !== this.ownerUserId) {
      throw new Error("MUSIC_RESTORATION_OWNER_MISMATCH");
    }
  }

  private async signedUrl(path: string): Promise<string> {
    const { data, error } = await this.client.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      throw new Error(`MUSIC_RESTORATION_SIGNED_URL_FAILED: ${error?.message ?? "missing signed URL"}`);
    }
    return data.signedUrl;
  }

  private parseStorageUri(uri: string): { bucket: string; path: string } {
    const prefix = "supabase-private://";
    if (!uri.startsWith(prefix)) throw new Error("MUSIC_RESTORATION_STORAGE_URI_INVALID");
    const rest = uri.slice(prefix.length);
    const slash = rest.indexOf("/");
    if (slash <= 0) throw new Error("MUSIC_RESTORATION_STORAGE_URI_INVALID");
    const bucket = rest.slice(0, slash);
    const path = rest.slice(slash + 1);
    if (bucket !== BUCKET || !path) throw new Error("MUSIC_RESTORATION_STORAGE_URI_NOT_ADMITTED");
    return { bucket, path };
  }
}
