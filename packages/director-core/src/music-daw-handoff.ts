import { createTimeline, type EditableTimeline, type TimelineTrack } from "./timeline-model.js";

/**
 * DAW-DIRECTOR.1 — draft-only, sample-clock-aligned soundtrack transport.
 * The local bounce receipt is SELF-ATTESTED until a trusted media ingester
 * hashes all actual WAV bytes and registers them into Director's asset store.
 * This module NEVER saves a timeline or fetches private media on its own.
 */
export interface DawDirectorStem {
  artifactId: string;
  trackName: string;
  role: string;
  fileName: string;
  outputSha256: string;
  sourceSha256: string;
  sampleCount: number;
}
export interface DawDirectorSourceReceipt {
  schema: "jhadina-music-daw-edited-stems/v1";
  caseId: string;
  revision: number;
  operationClass: "non-destructive-edited-stems-dry-bounce";
  masterOutputSha256: string;
  sampleRate: number;
  sampleCount: number;
  channels: 2;
  sourcesImmutable: true;
  pluginsExecuted: false;
  eqExecuted: false;
  compressionExecuted: false;
  restorationCertified: false;
  needsListeningReview: true;
  stems: DawDirectorStem[];
  readbackNullQc: {
    passed: true;
    maxAbsoluteError: number;
    residualRatio: number;
  };
  receiptSha256: string;
}
export interface DawDirectorRegisteredAsset {
  artifactId: string;
  /** Resolved by a trusted, owner-scoped Director media-asset registry. */
  directorAssetId: string;
  registeredOutputSha256: string;
  sampleRate: number;
  sampleCount: number;
  channels: 2;
  audioBytesVerified: true;
  registrationReceiptId: string;
}
export interface DawDirectorImportPlan {
  schema: "jhadina-daw-director-handoff/v1";
  caseId: string;
  revision: number;
  sourceReceiptSha256: string;
  sourceMasterSha256: string;
  sampleRate: number;
  sampleCount: number;
  timelineStartSample: 0;
  trackFiles: DawDirectorStem[];
  registrationStatus: "pending-owner-scoped-media-registration";
  restorationCertified: false;
  needsOwnerReview: true;
}

const SHA = /^[a-f0-9]{64}$/i;
const fileName = /^stems\/track-\d{2,3}\.wav$/;
const valid = (n: number, min: number, max: number) =>
  Number.isFinite(n) && n >= min && n <= max;

export function createDawDirectorImportPlan(receipt: DawDirectorSourceReceipt): DawDirectorImportPlan {
  if (receipt.schema !== "jhadina-music-daw-edited-stems/v1" ||
      receipt.operationClass !== "non-destructive-edited-stems-dry-bounce" ||
      !receipt.caseId || !Number.isSafeInteger(receipt.revision) || receipt.revision < 1 ||
      !SHA.test(receipt.receiptSha256) || !SHA.test(receipt.masterOutputSha256) ||
      ![44100,48000,96000].includes(receipt.sampleRate) ||
      !Number.isSafeInteger(receipt.sampleCount) || receipt.sampleCount < 1 ||
      receipt.sampleCount > receipt.sampleRate*1800 ||
      receipt.channels !== 2 || receipt.sourcesImmutable !== true ||
      receipt.pluginsExecuted !== false || receipt.eqExecuted !== false ||
      receipt.compressionExecuted !== false || receipt.restorationCertified !== false ||
      receipt.needsListeningReview !== true || receipt.readbackNullQc?.passed !== true ||
      !valid(receipt.readbackNullQc.maxAbsoluteError,0,4e-5) ||
      !valid(receipt.readbackNullQc.residualRatio,0,2e-5) ||
      !Array.isArray(receipt.stems) || !receipt.stems.length || receipt.stems.length > 48) {
    throw new Error("DAW_DIRECTOR_STEM_RECEIPT_UNVERIFIED");
  }
  const ids = new Set<string>(), names = new Set<string>();
  for (const stem of receipt.stems) {
    if (!stem || !stem.artifactId || !stem.trackName || !stem.role ||
        !fileName.test(stem.fileName) || !SHA.test(stem.sourceSha256) ||
        !SHA.test(stem.outputSha256) || stem.sampleCount !== receipt.sampleCount ||
        ids.has(stem.artifactId) || names.has(stem.fileName)) {
      throw new Error("DAW_DIRECTOR_STEM_SOURCE_BINDING_INVALID");
    }
    ids.add(stem.artifactId); names.add(stem.fileName);
  }
  return {
    schema: "jhadina-daw-director-handoff/v1", caseId: receipt.caseId,
    revision: receipt.revision, sourceReceiptSha256: receipt.receiptSha256,
    sourceMasterSha256: receipt.masterOutputSha256,
    sampleRate: receipt.sampleRate, sampleCount: receipt.sampleCount,
    timelineStartSample: 0, trackFiles: receipt.stems.map(t => ({...t})),
    registrationStatus: "pending-owner-scoped-media-registration",
    restorationCertified: false, needsOwnerReview: true,
  };
}

/** Produces a DRAFT solely after an external trusted ingest has re-read all
 * WAV files and matched the exact SHA/timebase to the saved edit revision.
 * No recording is automatically posted to the Director project. */
export function stageRegisteredDawDirectorAudio(input: {
  plan: DawDirectorImportPlan;
  projectId: string;
  registered: DawDirectorRegisteredAsset[];
  fps: number;
  width: number;
  height: number;
}): { timelineDraft: EditableTimeline; requiresOwnerReview: true;
  sourceCaseId: string; sourceRevision: number } {
  const p = input.plan;
  if (p.schema !== "jhadina-daw-director-handoff/v1" ||
      p.registrationStatus !== "pending-owner-scoped-media-registration" ||
      p.restorationCertified !== false || p.needsOwnerReview !== true ||
      !p.caseId || !SHA.test(p.sourceReceiptSha256) || !SHA.test(p.sourceMasterSha256) ||
      !input.projectId.trim() || !valid(input.fps,1,240) ||
      !Number.isSafeInteger(input.width) || input.width < 1 ||
      !Number.isSafeInteger(input.height) || input.height < 1 ||
      ![44100,48000,96000].includes(p.sampleRate) ||
      !Number.isSafeInteger(p.sampleCount) || p.sampleCount < 1 ||
      p.sampleCount > p.sampleRate*1800 ||
      p.timelineStartSample !== 0 || !Array.isArray(p.trackFiles) ||
      !p.trackFiles.length || input.registered.length !== p.trackFiles.length) {
    throw new Error("DAW_DIRECTOR_REGISTRATION_PLAN_INVALID");
  }
  const byId = new Map<string,DawDirectorRegisteredAsset>();
  const assetIds = new Set<string>();
  for (const asset of input.registered) {
    if (!asset.artifactId || byId.has(asset.artifactId) ||
        !asset.directorAssetId?.trim() || assetIds.has(asset.directorAssetId) ||
        !asset.registrationReceiptId?.trim() || asset.audioBytesVerified !== true ||
        !SHA.test(asset.registeredOutputSha256) ||
        asset.sampleRate !== p.sampleRate || asset.sampleCount !== p.sampleCount ||
        asset.channels !== 2) throw new Error("DAW_DIRECTOR_REGISTERED_MEDIA_INVALID");
    byId.set(asset.artifactId, asset);assetIds.add(asset.directorAssetId);
  }
  const duration = p.sampleCount/p.sampleRate;
  const tracks: TimelineTrack[] = p.trackFiles.map((stem,index) => {
    const asset = byId.get(stem.artifactId);
    if (!asset || asset.registeredOutputSha256.toLowerCase() !== stem.outputSha256.toLowerCase() ||
        stem.sampleCount !== p.sampleCount || !SHA.test(stem.sourceSha256) ||
        !fileName.test(stem.fileName)) {
      throw new Error("DAW_DIRECTOR_UNREGISTERED_OR_HASH_MISMATCH");
    }
    const trackId = "daw-audio:"+index;
    return {
      id:trackId, name:stem.trackName, kind:"audio",index,
      relationship:"lane", role:"music", muted:false,solo:false,
      clips:[{
        id:"daw-clip:"+index,assetId:asset.directorAssetId,trackId,
        startSeconds:0,durationSeconds:duration,sourceInSeconds:0,
        sourceOutSeconds:duration,sourceDurationSeconds:duration,
        name:stem.trackName,audioRole:"music",effects:[],generativeRegions:[],
      }],
    };
  });
  return {
    timelineDraft: createTimeline({
      projectId:input.projectId,fps:input.fps,width:input.width,
      height:input.height,durationSeconds:duration,playheadSeconds:0,
      tracks,transitions:[],markers:[],
    }),
    requiresOwnerReview:true,
    sourceCaseId:p.caseId,sourceRevision:p.revision,
  };
}
