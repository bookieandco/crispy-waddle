export type ReferenceCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '2.39:1' | 'free';
};

export type ReferenceAnnotation =
  | {
      id: string;
      kind: 'arrow';
      from: { x: number; y: number };
      to: { x: number; y: number };
      label?: string;
    }
  | {
      id: string;
      kind: 'text';
      at: { x: number; y: number };
      text: string;
    };

export type ReferenceShotMetadata = {
  sceneNo?: string;
  shotNo?: string;
  shotSize?: string;
  cameraAngle?: string;
  lens?: string;
  movement?: string;
  transition?: string;
  lighting?: string;
  mood?: string;
};

export type StoryboardReferenceFrame = {
  id: string;
  sourceAssetId: string;
  sourceTimeSeconds?: number;
  stillAssetId: string;
  stillSha256: string;
  label: string;
  crop: ReferenceCrop;
  metadata: ReferenceShotMetadata;
  annotations: readonly ReferenceAnnotation[];
  holdSeconds: number;
  notes?: string;
  prompt?: string;
  promptProfile?: string;
  evidenceIds: readonly string[];
};

export type StoryboardReferenceBoard = {
  id: string;
  projectId: string;
  title: string;
  frames: readonly StoryboardReferenceFrame[];
  scratchAudioAssetId?: string;
  authority: 'DIRECTOR_REFERENCE_BOARD';
};

export type StoryboardReferenceIssue = {
  code:
    | 'REFERENCE_BOARD_IDENTITY_REQUIRED'
    | 'REFERENCE_BOARD_FRAMES_REQUIRED'
    | 'REFERENCE_FRAME_IDENTITY_REQUIRED'
    | 'REFERENCE_FRAME_HASH_REQUIRED'
    | 'REFERENCE_FRAME_EVIDENCE_REQUIRED'
    | 'REFERENCE_FRAME_TIME_INVALID'
    | 'REFERENCE_FRAME_HOLD_INVALID'
    | 'REFERENCE_CROP_INVALID'
    | 'REFERENCE_ANNOTATION_INVALID';
  path: string;
  message: string;
};

export type ReferenceBoardAnimaticFrame = {
  frameId: string;
  stillAssetId: string;
  startSeconds: number;
  endSeconds: number;
  crop: ReferenceCrop;
  annotationIds: readonly string[];
};

export type StoryboardReferenceExportManifest = {
  boardId: string;
  projectId: string;
  frameOrder: readonly string[];
  stillAssetIds: readonly string[];
  promptFrameIds: readonly string[];
  totalDurationSeconds: number;
  animatic: readonly ReferenceBoardAnimaticFrame[];
  scratchAudioAssetId?: string;
};

export function validateStoryboardReferenceBoard(board: StoryboardReferenceBoard): StoryboardReferenceIssue[] {
  const issues: StoryboardReferenceIssue[] = [];
  if (!board.id.trim() || !board.projectId.trim() || !board.title.trim()) {
    issues.push(issue('REFERENCE_BOARD_IDENTITY_REQUIRED', 'id/projectId/title', 'Reference board requires stable identity and a title.'));
  }
  if (!board.frames.length) {
    issues.push(issue('REFERENCE_BOARD_FRAMES_REQUIRED', 'frames', 'Reference board needs at least one frame.'));
    return issues;
  }

  const ids = new Set<string>();
  board.frames.forEach((frame, index) => {
    if (!frame.id.trim() || !frame.sourceAssetId.trim() || !frame.stillAssetId.trim() || !frame.label.trim() || ids.has(frame.id)) {
      issues.push(issue('REFERENCE_FRAME_IDENTITY_REQUIRED', `frames[${index}]`, 'Reference frames need unique IDs, source/still assets and labels.'));
    }
    ids.add(frame.id);

    if (!frame.stillSha256.trim()) {
      issues.push(issue('REFERENCE_FRAME_HASH_REQUIRED', `frames[${index}].stillSha256`, 'Reference still needs a content hash.'));
    }
    if (!frame.evidenceIds.length) {
      issues.push(issue('REFERENCE_FRAME_EVIDENCE_REQUIRED', `frames[${index}].evidenceIds`, 'Reference frame needs provenance/evidence.'));
    }
    if (
      frame.sourceTimeSeconds !== undefined &&
      (!Number.isFinite(frame.sourceTimeSeconds) || frame.sourceTimeSeconds < 0)
    ) {
      issues.push(issue('REFERENCE_FRAME_TIME_INVALID', `frames[${index}].sourceTimeSeconds`, 'Reference source time must be non-negative.'));
    }
    if (!Number.isFinite(frame.holdSeconds) || frame.holdSeconds <= 0) {
      issues.push(issue('REFERENCE_FRAME_HOLD_INVALID', `frames[${index}].holdSeconds`, 'Animatic hold must be positive.'));
    }

    if (!validCrop(frame.crop)) {
      issues.push(issue('REFERENCE_CROP_INVALID', `frames[${index}].crop`, 'Crop must use normalized source coordinates inside the source image.'));
    }

    frame.annotations.forEach((annotation, annotationIndex) => {
      if (!validAnnotation(annotation)) {
        issues.push(issue(
          'REFERENCE_ANNOTATION_INVALID',
          `frames[${index}].annotations[${annotationIndex}]`,
          'Annotations must use normalized coordinates and contain the required text/arrow geometry.',
        ));
      }
    });
  });

  return issues;
}

export function assertStoryboardReferenceBoard(board: StoryboardReferenceBoard): StoryboardReferenceBoard {
  const issues = validateStoryboardReferenceBoard(board);
  if (issues.length) {
    throw new Error(`DIRECTOR_REFERENCE_BOARD_INVALID: ${issues.map((candidate) => `${candidate.code}@${candidate.path}`).join(', ')}`);
  }
  return board;
}

export function compileReferenceBoardExport(board: StoryboardReferenceBoard): StoryboardReferenceExportManifest {
  assertStoryboardReferenceBoard(board);

  let cursor = 0;
  const animatic = board.frames.map((frame): ReferenceBoardAnimaticFrame => {
    const startSeconds = cursor;
    cursor += frame.holdSeconds;
    return Object.freeze({
      frameId: frame.id,
      stillAssetId: frame.stillAssetId,
      startSeconds,
      endSeconds: cursor,
      crop: Object.freeze({ ...frame.crop }),
      annotationIds: Object.freeze(frame.annotations.map((annotation) => annotation.id)),
    });
  });

  return Object.freeze({
    boardId: board.id,
    projectId: board.projectId,
    frameOrder: Object.freeze(board.frames.map((frame) => frame.id)),
    stillAssetIds: Object.freeze(board.frames.map((frame) => frame.stillAssetId)),
    promptFrameIds: Object.freeze(board.frames.filter((frame) => frame.prompt?.trim()).map((frame) => frame.id)),
    totalDurationSeconds: cursor,
    animatic: Object.freeze(animatic),
    ...(board.scratchAudioAssetId ? { scratchAudioAssetId: board.scratchAudioAssetId } : {}),
  });
}

export function compileReferenceFrameDirective(frame: StoryboardReferenceFrame): string {
  const meta = frame.metadata;
  const lines = [
    `Reference frame: ${frame.label}`,
    `Match framing/crop: ${frame.crop.aspectRatio}; normalized crop x=${fmt(frame.crop.x)}, y=${fmt(frame.crop.y)}, w=${fmt(frame.crop.width)}, h=${fmt(frame.crop.height)}`,
    meta.shotSize && `Shot size: ${meta.shotSize}`,
    meta.cameraAngle && `Camera angle: ${meta.cameraAngle}`,
    meta.lens && `Lens: ${meta.lens}`,
    meta.movement && `Camera movement: ${meta.movement}`,
    meta.lighting && `Lighting: ${meta.lighting}`,
    meta.mood && `Mood: ${meta.mood}`,
    frame.notes && `Notes: ${frame.notes}`,
    frame.annotations.length
      ? `Annotations: ${frame.annotations.map(compileAnnotation).join(' | ')}`
      : undefined,
    frame.prompt && `Approved prompt: ${frame.prompt}`,
  ].filter((line): line is string => Boolean(line));

  return lines.join('\n');
}

function validCrop(crop: ReferenceCrop): boolean {
  const values = [crop.x, crop.y, crop.width, crop.height];
  return values.every(Number.isFinite) &&
    crop.x >= 0 &&
    crop.y >= 0 &&
    crop.width > 0 &&
    crop.height > 0 &&
    crop.x + crop.width <= 1 + 1e-9 &&
    crop.y + crop.height <= 1 + 1e-9;
}

function validAnnotation(annotation: ReferenceAnnotation): boolean {
  if (!annotation.id.trim()) return false;
  if (annotation.kind === 'text') {
    return annotation.text.trim().length > 0 && pointInside(annotation.at);
  }
  return pointInside(annotation.from) && pointInside(annotation.to);
}

function pointInside(point: { x: number; y: number }): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

function compileAnnotation(annotation: ReferenceAnnotation): string {
  if (annotation.kind === 'text') return `text "${annotation.text}" at (${fmt(annotation.at.x)},${fmt(annotation.at.y)})`;
  return `arrow (${fmt(annotation.from.x)},${fmt(annotation.from.y)}) -> (${fmt(annotation.to.x)},${fmt(annotation.to.y)})${annotation.label ? ` ${annotation.label}` : ''}`;
}

function issue(
  code: StoryboardReferenceIssue['code'],
  path: string,
  message: string,
): StoryboardReferenceIssue {
  return { code, path, message };
}

function fmt(value: number): string {
  return String(Number(value.toFixed(4)));
}
