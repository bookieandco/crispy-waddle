import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReviewedAudioReceipt } from "./verified-audio-admission";
import { planVerifiedOwnedAudioAdmission } from "./verified-audio-admission";

/**
 * Server-side operator process ONLY. Never import this in a public API route.
 * Service-role access is supplied by a dedicated operator process, not created
 * from NEXT_PUBLIC_ env keys. Postgres RPC rechecks ownership and commits atomically.
 */
export interface OperatorMusicAdmissionInput {
  receipt: ReviewedAudioReceipt;
  trustedStorageOrigin: string;
  operatorIdentity: string;
  admissionEnabled: boolean;
}
export interface OperatorMusicAdmissionResult {
  admitted: true;
  assetId: string;
  trackId: string;
}
export async function commitReviewedMusicAdmission(
  privileged: SupabaseClient, input: OperatorMusicAdmissionInput,
): Promise<OperatorMusicAdmissionResult> {
  if (!input.admissionEnabled || !input.operatorIdentity
    || input.operatorIdentity !== input.receipt?.operatorId
    || !input.trustedStorageOrigin) {
    throw new Error("Music operator review gate locked");
  }
  // Reject any spoofed owner/folder BEFORE invoking privileged Storage APIs.
  const owner = input.receipt.ownerUserId;
  const path = input.receipt.storagePath;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(owner) || !path.startsWith(owner + "/")
    || !/^[0-9a-f-]{36}\.(?:mp3|wav|flac|m4a|aac|ogg|opus)$/i.test(path.slice(owner.length + 1))) {
    throw new Error("Music operator object ownership validation required");
  }
  if (!Number.isInteger(input.receipt.byteCount) || input.receipt.byteCount < 1
    || input.receipt.byteCount > 50 * 1024 * 1024) {
    throw new Error("Music operator byte-limit validation required");
  }
  const { data, error } = await privileged.storage.from("music-owned")
    .download(input.receipt.storagePath);
  if (error || !data) throw new Error("Independent owned object readback unavailable");
  const bytes = new Uint8Array(await data.arrayBuffer());
  const plan = planVerifiedOwnedAudioAdmission(
    input.receipt, input.trustedStorageOrigin, bytes,
  );
  if (plan.ownerUserId !== input.receipt.ownerUserId) {
    throw new Error("Music ownership mismatch");
  }
  const committed = await privileged.rpc("music_operator_admit_owned", {
    _owner: plan.ownerUserId, _source: plan.source, _asset: plan.asset,
  });
  const reply = committed.data as Record<string, unknown> | null;
  if (committed.error || reply?.admitted !== true
    || reply.assetId !== plan.asset.id || reply.trackId !== plan.asset.trackId) {
    throw new Error("Music operator admission not committed");
  }
  return { admitted: true, assetId: plan.asset.id, trackId: plan.asset.trackId };
}
