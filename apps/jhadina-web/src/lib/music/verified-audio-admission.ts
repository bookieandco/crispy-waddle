import { createHash, timingSafeEqual } from "node:crypto";
import type { MediaAsset, MusicSource, Track } from "@jhadina/music-core";

/**
 * Separately reviewed operator plan. This module deliberately performs NO
 * database mutation. The uploader's own checkbox is not a rights grant.
 */
export interface ReviewedAudioReceipt {
  ownerUserId: string;
  track: Track;
  storageBucket: "music-owned";
  storagePath: string;
  storageObjectUrl: string;
  contentSha256: string;
  byteCount: number;
  mimeType: string;
  actualBytesVerifiedAt: string;
  rightsEvidenceRef: string;
  rightsReviewedAt: string;
  rightsReviewedBy: string;
  operatorId: string;
}
export interface AuthorizedAudioAdmissionPlan {
  ownerUserId: string;
  source: MusicSource;
  asset: MediaAsset;
  verificationRequired: false;
  executed: false;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const HEX_PATH = /^[a-f0-9-]{36}\.(?:mp3|wav|flac|m4a|aac|ogg|opus)$/i;
const MIME = new Set(["audio/mpeg","audio/mp4","audio/x-m4a","audio/wav","audio/x-wav","audio/flac","audio/ogg","audio/aac"]);

export function planVerifiedOwnedAudioAdmission(
  receipt: ReviewedAudioReceipt,
  trustedStorageOrigin: string,
  independentlyDownloadedBytes: Uint8Array,
  nowMs = Date.now(),
): AuthorizedAudioAdmissionPlan {
  const owner = receipt.ownerUserId;
  const path = receipt.storagePath;
  if (!UUID.test(owner) || !receipt.track?.id || receipt.track.id.length > 256
    || !receipt.track.title?.trim() || receipt.track.title.length > 250
    || !Array.isArray(receipt.track.artistIds)
    || receipt.storageBucket !== "music-owned"
    || path !== `${owner}/${path?.slice(owner.length + 1)}`
    || !HEX_PATH.test(path?.slice(owner.length + 1) ?? "")
    || !SHA256.test(receipt.contentSha256)
    || !Number.isInteger(receipt.byteCount) || receipt.byteCount <= 0
    || receipt.byteCount > 50 * 1024 * 1024 || !MIME.has(receipt.mimeType)
    || !receipt.rightsEvidenceRef?.trim() || receipt.rightsEvidenceRef.length > 512
    || !receipt.rightsReviewedBy?.trim() || receipt.rightsReviewedBy === owner
    || !receipt.operatorId?.trim() || receipt.operatorId === owner
    || receipt.operatorId === receipt.rightsReviewedBy) {
    throw new Error("Independent verified audio rights and owner receipt required");
  }
  for (const timestamp of [receipt.actualBytesVerifiedAt, receipt.rightsReviewedAt]) {
    const parsed = Date.parse(timestamp);
    if (!Number.isFinite(parsed) || parsed > nowMs || nowMs - parsed > 90 * 86400000) {
      throw new Error("Audio verification evidence expired or invalid");
    }
  }
  // A persisted asset URL MUST NOT be a signed download credential and should
  // refer to precisely this private object, not a provider/public CDN.
  let url: URL;
  try { url = new URL(receipt.storageObjectUrl); } catch { throw new Error("Invalid owned audio origin"); }
  const suffix = `/storage/v1/object/authenticated/music-owned/${path}`;
  let trusted: URL;
  try { trusted = new URL(trustedStorageOrigin); } catch { throw new Error("Trusted private Storage origin required"); }
  if (trusted.protocol !== "https:" || !trusted.hostname || trusted.pathname !== "/"
    || trusted.search || trusted.hash || trusted.username || trusted.password) {
    throw new Error("Trusted private Storage origin required");
  }
  if (url.origin !== trusted.origin) throw new Error("Private object URL origin mismatch");
  if (url.protocol !== "https:" || !url.hostname
    || url.username || url.password || url.search || url.hash
    || url.pathname !== suffix) throw new Error("Authenticated private object URL required");
  const ext = path.split(".").pop()?.toLowerCase();
  if ((ext === "mp3" && receipt.mimeType !== "audio/mpeg")
    || (ext === "flac" && receipt.mimeType !== "audio/flac")
    || (ext === "wav" && !["audio/wav","audio/x-wav"].includes(receipt.mimeType))
    || (ext === "m4a" && !["audio/mp4","audio/x-m4a"].includes(receipt.mimeType))
    || (ext === "aac" && receipt.mimeType !== "audio/aac")
    || (["ogg","opus"].includes(ext ?? "") && receipt.mimeType !== "audio/ogg")) {
    throw new Error("Verified file type does not match admitted audio object");
  }
  // Observed bytes are supplied from a separate operator-controlled readback of
  // the private Storage object, NOT from the uploader's unsigned claims.
  if (!(independentlyDownloadedBytes instanceof Uint8Array)
    || independentlyDownloadedBytes.byteLength !== receipt.byteCount
    || independentlyDownloadedBytes.byteLength > 50 * 1024 * 1024) {
    throw new Error("Actual private-object byte count differs from reviewed receipt");
  }
  const observedHash = createHash("sha256").update(independentlyDownloadedBytes).digest();
  const expectedHash = Buffer.from(receipt.contentSha256, "hex");
  if (expectedHash.length !== observedHash.length || !timingSafeEqual(expectedHash, observedHash)) {
    throw new Error("Private-object SHA-256 does not match independent bytes");
  }
  const checksum = receipt.contentSha256.toLowerCase();
  const sourceId = `owned:${checksum.slice(0,32)}`;
  const source: MusicSource = {
    id: sourceId, userId: owner, kind: "local", name: "Verified owned recording",
    authorized: true, metadata: {
      role: "verified-owned-master",
      rightsEvidenceRef: receipt.rightsEvidenceRef,
      rightsReviewedBy: receipt.rightsReviewedBy,
      rightsReviewedAt: receipt.rightsReviewedAt,
      operatorId: receipt.operatorId,
      contentSha256: checksum,
      verifiedBytes: receipt.byteCount,
      verifiedAt: receipt.actualBytesVerifiedAt,
    },
  };
  const asset: MediaAsset = {
    // The same licensed master can back multiple track records. The asset ID
    // must include track + object identity to prevent upsert collisions.
    id: `owned:${createHash("sha256").update([owner, receipt.track.id, path, checksum].join("\\0")).digest("hex")}`,
    sourceId, trackId: receipt.track.id,
    kind: "file", uri: receipt.storageObjectUrl,
    mimeType: receipt.mimeType,
    provenance: {
      playbackAuthorized: true, storageBucket: "music-owned", storagePath: path,
      contentSha256: checksum, verifiedBytes: receipt.byteCount,
      rightsEvidenceRef: receipt.rightsEvidenceRef,
    },
  };
  return { ownerUserId: owner, source, asset, verificationRequired: false, executed: false };
}
