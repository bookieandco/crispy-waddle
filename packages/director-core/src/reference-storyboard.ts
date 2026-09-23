import type { DirectorCameraPlan } from './camera-language.js';

export type ReferenceSourceKind = 'video-frame' | 'image' | 'phone-footage' | 'generated-reference';
export type ReferenceAnnotationKind = 'camera-move' | 'action' | 'focus' | 'blocking' | 'note';

export interface NormalizedCrop {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '2.39:1' | 'custom';
}

export interface ReferenceAnnotation {
  id: string;
  kind: ReferenceAnnotationKind;
  text?: string;
  /** Normalized points in source-frame coordinates. */
  points?: readonly Array<{ x: number; y: number }>;
}

export interface ReferenceStoryboardFrame {
  id: string;
  projectId: string;
  sourceAssetId: string;
  sourceSha256: string;
  sourceKind: ReferenceSourceKind;
  sourceTimeSeconds?: number;
  extractedStillAssetId: string;
  extractedStillSha256: string;
  label: string;
  crop: NormalizedCrop;
  holdSeconds: number;
  cameraPlan?: DirectorCameraPlan;
  annotations: readonly ReferenceAnnotation[];
  promptText?: string;
  promptEvidenceIds?: readonly string[];
  evidenceIds: readonly string[];
}

export interface ReferenceStoryboardBoard {
  id: string;
  projectId: string;
  title: string;
  frameIds: readonly string[];
  audioScratchAssetId?: string;
  version: number;
  authority: 'DIRECTOR_REFERENCE_BOARD';
}

export type ReferenceStoryboardDeliverableKind =
  | 'board-package'
  | 'animatic'
  | 'storyboard-pdf'
  | 'shot-list'
  | 'contact-sheet'
  | 'machine-readable-board';

export interface ReferenceStoryboardDeliverable {
  kind: ReferenceStoryboardDeliverableKind;
  assetId: string;
  sha256: string;
  generatedFromBoardVersion: number;
  evidenceIds: readonly string[];
}

export interface ReferenceStoryboardIssue {
  code:
    | 'REFERENCE_BOARD_IDENTITY_REQUIRED'
    | 'REFERENCE_BOARD_FRAME_REQUIRED'
    | 'REFERENCE_FRAME_IDENTITY_REQUIRED'
    | 'REFERENCE_SOURCE_TIME_INVALID'
    | 'REFERENCE_CROP_INVALID'
    | 'REFERENCE_HOLD_INVALID'
    | 'REFERENCE_ANNOTATION_INVALID'
    | 'REFERENCE_PROMPT_EVIDENCE_REQUIRED'
    | 'REFERENCE_FRAME_EVIDENCE_REQUIRED'
    | 'REFERENCE_BOARD_DUPLICATE_FRAME';
  path: string;
  message: string;
}

export function validateReferenceStoryboard(
  board: ReferenceStoryboardBoard,
  frames: readonly ReferenceStoryboardFrame[],
): readonly ReferenceStoryboardIssue[] {
  const issues: ReferenceStoryboardIssue[] = [];
  if (!board.id.trim() || !board.projectId.trim() || !board.title.trim()) {
    issues.push(issue('REFERENCE_BOARD_IDENTITY_REQUIRED', 'board', 'Reference board requires stable identity and title.'));
  }
  if (!board.frameIds.length) {
    issues.push(issue('REFERENCE_BOARD_FRAME_REQUIRED', 'board.frameIds', 'Reference board requires at least one frame.'));
  }
  if (new Set(board.frameIds).size !== board.frameIds.length) {
    issues.push(issue('REFERENCE_BOARD_DUPLICATE_FRAME', 'board.frameIds', 'Reference board cannot contain duplicate frame IDs.'));
  }

  const byId = new Map(frames.map((frame) => [frame.id, frame]));
  board.frameIds.forEach((frameId, index) => {
    const frame = byId.get(frameId);
    if (!frame) {
      issues.push(issue('REFERENCE_BOARD_FRAME_REQUIRED', `board.frameIds[${index}]`, `Unknown reference frame: ${frameId}`));
      return;
    }
    validateFrame(frame, `frames[${frameId}]`, issues);
  });

  return Object.freeze(issues);
}

export function compileReferenceStoryboardShotList(
  board: ReferenceStoryboardBoard,
  frames: readonly ReferenceStoryboardFrame[],
): string {
  const issues = validateReferenceStoryboard(board, frames);
  if (issues.length) {
    throw new Error(`DIRECTOR_REFERENCE_BOARD_INVALID: ${issues.map((candidate) => `${candidate.code}@${candidate.path}`).join(', ')}`);
  }
  const byId = new Map(frames.map((frame) => [frame.id, frame]));

  let cursor = 0;
  return board.frameIds.map((frameId, index) => {
    const frame = byId.get(frameId)!;
    const start = cursor;
    const end = start + frame.holdSeconds;
    cursor = end;
    return [
      `SHOT ${index + 1} ${format(start)}-${format(end)}s`,
      `Label: ${frame.label}`,
      `Reference still: ${frame.extractedStillAssetId}`,
      `Crop: x=${format(frame.crop.x)}, y=${format(frame.crop.y)}, w=${format(frame.crop.width)}, h=${format(frame.crop.height)}${frame.crop.aspectRatio ? `, aspect=${frame.crop.aspectRatio}` : ''}`,
      frame.cameraPlan ? `Camera intent: ${frame.cameraPlan.intent.narrativeFunction}` : undefined,
      frame.annotations.length ? `Annotations: ${frame.annotations.map((annotation) => annotation.text || annotation.kind).join(' | ')}` : undefined,
      frame.promptText ? `Reference-derived prompt: ${frame.promptText}` : undefined,
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

export function validateReferenceStoryboardDeliverables(
  board: ReferenceStoryboardBoard,
  deliverables: readonly ReferenceStoryboardDeliverable[],
): readonly string[] {
  const reasons: string[] = [];
  const seen = new Set<ReferenceStoryboardDeliverableKind>();
  for (const deliverable of deliverables) {
    if (seen.has(deliverable.kind)) reasons.push(`DIRECTOR_REFERENCE_DELIVERABLE_DUPLICATE:${deliverable.kind}`);
    seen.add(deliverable.kind);
    if (!deliverable.assetId.trim() || !deliverable.sha256.trim() || !deliverable.evidenceIds.length) {
      reasons.push(`DIRECTOR_REFERENCE_DELIVERABLE_PROVENANCE_REQUIRED:${deliverable.kind}`);
    }
    if (deliverable.generatedFromBoardVersion !== board.version) {
      reasons.push(`DIRECTOR_REFERENCE_DELIVERABLE_STALE:${deliverable.kind}`);
    }
  }
  return Object.freeze([...new Set(reasons)]);
}

function validateFrame(
  frame: ReferenceStoryboardFrame,
  path: string,
  issues: ReferenceStoryboardIssue[],
): void {
  if (
    !frame.id.trim() ||
    !frame.projectId.trim() ||
    !frame.sourceAssetId.trim() ||
    !frame.sourceSha256.trim() ||
    !frame.extractedStillAssetId.trim() ||
    !frame.extractedStillSha256.trim() ||
    !frame.label.trim()
  ) {
    issues.push(issue('REFERENCE_FRAME_IDENTITY_REQUIRED', path, 'Reference frame identity/provenance is incomplete.'));
  }
  if (frame.sourceTimeSeconds !== undefined && (!Number.isFinite(frame.sourceTimeSeconds) || frame.sourceTimeSeconds < 0)) {
    issues.push(issue('REFERENCE_SOURCE_TIME_INVALID', `${path}.sourceTimeSeconds`, 'Source time must be a non-negative finite number.'));
  }
  const crop = frame.crop;
  if (
    [crop.x, crop.y, crop.width, crop.height].some((value) => !Number.isFinite(value)) ||
    crop.x < 0 ||
    crop.y < 0 ||
    crop.width <= 0 ||
    crop.height <= 0 ||
    crop.x + crop.width > 1 ||
    crop.y + crop.height > 1
  ) {
    issues.push(issue('REFERENCE_CROP_INVALID', `${path}.crop`, 'Crop must remain inside normalized source-frame coordinates.'));
  }
  if (!Number.isFinite(frame.holdSeconds) || frame.holdSeconds <= 0) {
    issues.push(issue('REFERENCE_HOLD_INVALID', `${path}.holdSeconds`, 'Animatic hold must be a positive finite duration.'));
  }
  if (!frame.evidenceIds.length) {
    issues.push(issue('REFERENCE_FRAME_EVIDENCE_REQUIRED', `${path}.evidenceIds`, 'Reference frame requires evidence/provenance.'));
  }
  if (frame.promptText?.trim() && !frame.promptEvidenceIds?.length) {
    issues.push(issue('REFERENCE_PROMPT_EVIDENCE_REQUIRED', `${path}.promptEvidenceIds`, 'Reference-derived prompts require evidence IDs.'));
  }
  frame.annotations.forEach((annotation, index) => {
    if (!annotation.id.trim() || (!annotation.text?.trim() && !annotation.points?.length)) {
      issues.push(issue('REFERENCE_ANNOTATION_INVALID', `${path}.annotations[${index}]`, 'Annotation needs an ID plus text or geometry.'));
    }
    for (const point of annotation.points ?? []) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
        issues.push(issue('REFERENCE_ANNOTATION_INVALID', `${path}.annotations[${index}].points`, 'Annotation points must use normalized frame coordinates.'));
      }
    }
  });
}

function issue(
  code: ReferenceStoryboardIssue['code'],
  path: string,
  message: string,
): ReferenceStoryboardIssue {
  return { code, path, message };
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}
