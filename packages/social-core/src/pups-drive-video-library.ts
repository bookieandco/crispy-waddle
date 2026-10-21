import { createContentProject, type ContentProject } from "./content-projects.js";
import type { ReferenceRightsState } from "./reference-adaptation.js";

/**
 * Owner-scoped PupsonStuff reference-video planning.
 * This is deliberately pure: no Drive API, persistence, video distribution,
 * provider schedule, rights inference, or approval authority.
 * Actual Drive IDs and owner identities must be stored privately, never in
 * source fixtures or a public repository.
 */
export type PupsInspectionState = "metadata_only" | "frames_reviewed" | "audio_reviewed" | "full_av_reviewed";

export interface PupsDriveVideo {
  id: string;
  ownerUserId: string;
  brand: "pupsonstuff";
  driveFileId: string;
  filename: string;
  mimeType: "video/mp4";
  bytes: number;
  durationSeconds: number;
  width: number;
  height: number;
  hasAudio: boolean;
  observedAt: string;
  inspection: PupsInspectionState;
  inspectionEvidenceRefs: readonly string[];
  visualNotes: readonly string[];
  tags: readonly string[];
  rightsState: ReferenceRightsState;
  rightsEvidenceRefs: readonly string[];
  visibility: "owner_only";
}

export interface PupsVideoCatalog {
  ownerUserId: string;
  brand: "pupsonstuff";
  videos: readonly PupsDriveVideo[];
  access: "owner_only";
  publicationAuthority: "NONE";
}

export interface PupsOriginalConcept {
  id: string;
  sourceId: string;
  ownerUserId: string;
  title: string;
  hook: string;
  originalBeats: readonly string[];
  cta: string;
  project: ContentProject;
  sourceUsage: "INSPIRATION_ONLY";
  sourceMediaReusable: false;
  review: "draft";
  publicationAuthority: "NONE";
}

function required(text: string, code: string): string {
  if (typeof text !== "string" || !text.trim()) throw new Error(code);
  return text.trim();
}
function iso(date: string): void {
  if (!Number.isFinite(Date.parse(date))) throw new Error("PUPS_SOURCE_DATE_INVALID");
}
function uniqueStrings(values: readonly string[], code: string): readonly string[] {
  if (!Array.isArray(values) || values.some((v) => typeof v !== "string" || !v.trim())) {
    throw new Error(code);
  }
  return Object.freeze([...new Set(values.map((v) => v.trim()))]);
}
function positiveNumber(n: number, code: string): void {
  if (!Number.isFinite(n) || n <= 0) throw new Error(code);
}
function positiveInteger(n: number, code: string): void {
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(code);
}

export function validatePupsDriveVideo(raw: PupsDriveVideo): PupsDriveVideo {
  required(raw.id, "PUPS_SOURCE_ID_REQUIRED");
  required(raw.ownerUserId, "PUPS_OWNER_REQUIRED");
  if (raw.brand !== "pupsonstuff" || raw.visibility !== "owner_only") {
    throw new Error("PUPS_SOURCE_SCOPE_DENIED");
  }
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(raw.driveFileId)) throw new Error("PUPS_DRIVE_ID_INVALID");
  if (raw.mimeType !== "video/mp4" || !raw.filename.toLowerCase().endsWith(".mp4")) {
    throw new Error("PUPS_MP4_REQUIRED");
  }
  positiveInteger(raw.bytes, "PUPS_BYTES_INVALID");
  positiveNumber(raw.durationSeconds, "PUPS_DURATION_INVALID");
  positiveInteger(raw.width, "PUPS_WIDTH_INVALID");
  positiveInteger(raw.height, "PUPS_HEIGHT_INVALID");
  if (typeof raw.hasAudio !== "boolean") throw new Error("PUPS_AUDIO_FLAG_INVALID");
  iso(raw.observedAt);
  if (!["metadata_only", "frames_reviewed", "audio_reviewed", "full_av_reviewed"].includes(raw.inspection)) {
    throw new Error("PUPS_INSPECTION_INVALID");
  }
  if (!["owned", "licensed", "public_reference_only", "unknown"].includes(raw.rightsState)) {
    throw new Error("PUPS_RIGHTS_INVALID");
  }
  const inspectionEvidenceRefs = uniqueStrings(raw.inspectionEvidenceRefs, "PUPS_INSPECTION_EVIDENCE_INVALID");
  const rightsEvidenceRefs = uniqueStrings(raw.rightsEvidenceRefs, "PUPS_RIGHTS_EVIDENCE_INVALID");
  const visualNotes = uniqueStrings(raw.visualNotes, "PUPS_NOTES_INVALID");
  const tags = uniqueStrings(raw.tags, "PUPS_TAGS_INVALID");
  if (raw.inspection === "metadata_only" && visualNotes.length) {
    throw new Error("PUPS_VISUAL_CLAIM_UNINSPECTED");
  }
  if (raw.inspection !== "metadata_only" && !inspectionEvidenceRefs.length) {
    throw new Error("PUPS_INSPECTION_EVIDENCE_REQUIRED");
  }
  if (["owned", "licensed"].includes(raw.rightsState) && !rightsEvidenceRefs.length) {
    throw new Error("PUPS_RIGHTS_PROOF_REQUIRED");
  }
  return Object.freeze({
    ...raw, id: raw.id.trim(), ownerUserId: raw.ownerUserId.trim(),
    filename: raw.filename.trim(), inspectionEvidenceRefs, rightsEvidenceRefs, visualNotes, tags,
  });
}

export function indexPupsDriveVideos(
  ownerUserId: string, videos: readonly PupsDriveVideo[],
): PupsVideoCatalog {
  const owner = required(ownerUserId, "PUPS_OWNER_REQUIRED");
  const ids = new Set<string>();
  const driveIds = new Set<string>();
  const validated = videos.map((video) => {
    const source = validatePupsDriveVideo(video);
    if (source.ownerUserId !== owner) throw new Error("PUPS_OWNER_SCOPE_DENIED");
    if (ids.has(source.id) || driveIds.has(source.driveFileId)) {
      throw new Error("PUPS_DUPLICATE_SOURCE");
    }
    ids.add(source.id);
    driveIds.add(source.driveFileId);
    return source;
  });
  return Object.freeze({
    ownerUserId: owner, brand: "pupsonstuff" as const,
    videos: Object.freeze(validated), access: "owner_only" as const,
    publicationAuthority: "NONE" as const,
  });
}

/** Call only after a separately authenticated, exact-owner server check. */
export function searchPupsDriveVideos(
  catalog: PupsVideoCatalog, ownerUserId: string, query: string,
): readonly PupsDriveVideo[] {
  if (catalog.ownerUserId !== required(ownerUserId, "PUPS_OWNER_REQUIRED")) {
    throw new Error("PUPS_OWNER_SCOPE_DENIED");
  }
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return Object.freeze(catalog.videos.filter((video) => {
    const searchable = [video.filename, ...video.visualNotes, ...video.tags].join(" ").toLocaleLowerCase();
    return words.every((word) => searchable.includes(word));
  }));
}

/** A text-only original concept, NOT a permission to reproduce reference media. */
export function proposePupsOriginalConcept(input: {
  catalog: PupsVideoCatalog;
  ownerUserId: string;
  sourceId: string;
  conceptId: string;
  title: string;
  hook: string;
  originalBeats: readonly string[];
  cta: string;
  createdAt: string;
}): PupsOriginalConcept {
  if (input.catalog.ownerUserId !== required(input.ownerUserId, "PUPS_OWNER_REQUIRED")) {
    throw new Error("PUPS_OWNER_SCOPE_DENIED");
  }
  const source = input.catalog.videos.find((v) => v.id === input.sourceId);
  if (!source) throw new Error("PUPS_SOURCE_NOT_FOUND");
  const conceptId = required(input.conceptId, "PUPS_CONCEPT_ID_REQUIRED");
  const title = required(input.title, "PUPS_TITLE_REQUIRED");
  const hook = required(input.hook, "PUPS_HOOK_REQUIRED");
  const cta = required(input.cta, "PUPS_CTA_REQUIRED");
  const originalBeats = uniqueStrings(input.originalBeats, "PUPS_BEATS_INVALID");
  if (originalBeats.length < 3) throw new Error("PUPS_THREE_ORIGINAL_BEATS_REQUIRED");
  iso(input.createdAt);
  const evidenceRefs = Object.freeze([
    "pups-private-source:" + source.id, ...source.inspectionEvidenceRefs,
  ]);
  const project = createContentProject({
    id: "pups-concept:" + conceptId, brand: "pupsonstuff",
    authorityPositionRef: "pupsonstuff-brand",
    pillarRef: "pupsonstuff-original-dog-comedy",
    bigIdeaRef: "pups-original-concept:" + conceptId,
    primaryJob: "reach", origin: "ai_generated",
    evidenceRefs, createdAt: input.createdAt,
    anchor: {
      id: "pups-concept:" + conceptId + ":storyboard",
      kind: "short_video", transformation: "original",
      text: [title, hook, ...originalBeats, cta].join("\n"),
      mediaRefs: [], evidenceRefs,
    },
  });
  return Object.freeze({
    id: conceptId, sourceId: source.id, ownerUserId: source.ownerUserId,
    title, hook, originalBeats, cta, project,
    sourceUsage: "INSPIRATION_ONLY" as const,
    sourceMediaReusable: false as const, review: "draft" as const,
    publicationAuthority: "NONE" as const,
  });
}

export interface PupsReviewedConcept extends Omit<PupsOriginalConcept, "review"> {
  review: "accepted_for_planning" | "rejected";
  reviewerId: string;
  reviewedAt: string;
}

/** Accept for a draft calendar only; owner review is NOT platform publication consent. */
export function reviewPupsOriginalConcept(
  concept: PupsOriginalConcept, ownerUserId: string,
  decision: "accept" | "reject", reviewedAt: string,
): PupsReviewedConcept {
  if (concept.ownerUserId !== required(ownerUserId, "PUPS_OWNER_REQUIRED")) {
    throw new Error("PUPS_OWNER_SCOPE_DENIED");
  }
  if (concept.review !== "draft") throw new Error("PUPS_CONCEPT_ALREADY_REVIEWED");
  if (decision !== "accept" && decision !== "reject") throw new Error("PUPS_REVIEW_INVALID");
  iso(reviewedAt);
  return Object.freeze({
    ...concept,
    review: decision === "accept" ? "accepted_for_planning" as const : "rejected" as const,
    reviewerId: ownerUserId, reviewedAt,
  });
}

export type PupsPlanningPlatform = "instagram" | "tiktok" | "youtube" | "facebook";

export interface PupsCalendarDraftSlot {
  id: string;
  conceptId: string;
  ownerUserId: string;
  brand: "pupsonstuff";
  platform: PupsPlanningPlatform;
  localDate: string;
  hasProviderAccountBinding: false;
  isQueued: false;
  sourceMediaReusable: false;
  requiresCanonicalPublicationApproval: true;
}

/** A proposed 1–7 day slate, never a scheduled provider job or publish proposal. */
export function planPupsVideoWeek(input: {
  ownerUserId: string;
  concepts: readonly PupsReviewedConcept[];
  firstLocalDate: string;
  platformByConceptId: Readonly<Record<string, PupsPlanningPlatform>>;
}): readonly PupsCalendarDraftSlot[] {
  const owner = required(input.ownerUserId, "PUPS_OWNER_REQUIRED");
  if (input.concepts.length < 1 || input.concepts.length > 7) {
    throw new Error("PUPS_WEEK_DRAFT_LIMIT");
  }
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(input.firstLocalDate)) {
    throw new Error("PUPS_LOCAL_DATE_INVALID");
  }
  const first = new Date(input.firstLocalDate + "T12:00:00Z");
  if (!Number.isFinite(first.getTime())
      || first.toISOString().slice(0, 10) !== input.firstLocalDate) {
    throw new Error("PUPS_LOCAL_DATE_INVALID");
  }
  const seen = new Set<string>();
  return Object.freeze(input.concepts.map((concept, index) => {
    if (seen.has(concept.id)) throw new Error("PUPS_CONCEPT_DUPLICATE");
    seen.add(concept.id);
    if (concept.ownerUserId !== owner || concept.reviewerId !== owner
        || concept.review !== "accepted_for_planning"
        || concept.project.brand !== "pupsonstuff") {
      throw new Error("PUPS_OWNER_REVIEW_REQUIRED");
    }
    if (concept.project.assets.some((asset) => asset.mediaRefs.length)) {
      throw new Error("PUPS_REFERENCE_MEDIA_NOT_CALENDAR_INPUT");
    }
    const platform = input.platformByConceptId[concept.id];
    if (!["instagram", "tiktok", "youtube", "facebook"].includes(platform)) {
      throw new Error("PUPS_PLATFORM_INVALID");
    }
    const localDate = new Date(first.getTime() + index * 86400000)
      .toISOString().slice(0, 10);
    return Object.freeze({
      id: "pups-draft-slot:" + concept.id,
      conceptId: concept.id, ownerUserId: owner, brand: "pupsonstuff" as const,
      platform, localDate, hasProviderAccountBinding: false as const,
      isQueued: false as const, sourceMediaReusable: false as const,
      requiresCanonicalPublicationApproval: true as const,
    });
  }));
}
