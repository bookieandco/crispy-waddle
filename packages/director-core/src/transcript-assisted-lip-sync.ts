export type TranscriptTimingMode = 'untimed-text' | 'timed-cues';

export interface TranscriptCue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
}

export interface TranscriptLipSyncPlan {
  id: string;
  projectId: string;
  audioAssetId: string;
  mode: TranscriptTimingMode;
  audioDurationMs: number;
  text?: string;
  cues?: readonly TranscriptCue[];
  language?: string;
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_TRANSCRIPT_LIP_SYNC_PLAN';
}

export interface TranscriptLipSyncPolicy {
  maxUntimedDurationMs?: number;
  requireTimedCues?: boolean;
}

export interface TranscriptLipSyncDecision {
  valid: boolean;
  reasons: readonly string[];
}

export function parseSrtTranscript(srt: string): readonly TranscriptCue[] {
  const normalized = srt.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return Object.freeze([]);

  const cues: TranscriptCue[] = [];
  const blocks = normalized.split(/\n{2,}/);
  for (let index = 0; index < blocks.length; index += 1) {
    const lines = blocks[index]!.split('\n').map(line => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    const timeIndex = lines.findIndex(line => line.includes('-->'));
    if (timeIndex < 0) throw new Error(`DIRECTOR_TRANSCRIPT_SRT_TIMECODE_REQUIRED:${index + 1}`);
    const match = lines[timeIndex]!.match(
      /^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/,
    );
    if (!match) throw new Error(`DIRECTOR_TRANSCRIPT_SRT_TIMECODE_INVALID:${index + 1}`);

    const startMs = toMilliseconds(match.slice(1, 5).map(Number));
    const endMs = toMilliseconds(match.slice(5, 9).map(Number));
    const text = lines.slice(timeIndex + 1).join(' ').trim();
    const id = timeIndex > 0 && lines[0] ? lines[0] : `cue:${index + 1}`;
    cues.push(Object.freeze({ id, startMs, endMs, text }));
  }
  return Object.freeze(cues);
}

export function validateTranscriptLipSyncPlan(
  plan: TranscriptLipSyncPlan,
  policy: TranscriptLipSyncPolicy = {},
): TranscriptLipSyncDecision {
  const reasons: string[] = [];
  if (!plan.id.trim() || !plan.projectId.trim() || !plan.audioAssetId.trim()) {
    reasons.push('DIRECTOR_TRANSCRIPT_IDENTITY_REQUIRED');
  }
  if (!Number.isFinite(plan.audioDurationMs) || plan.audioDurationMs <= 0) {
    reasons.push('DIRECTOR_TRANSCRIPT_AUDIO_DURATION_INVALID');
  }
  if (!plan.evidenceIds.length) reasons.push('DIRECTOR_TRANSCRIPT_EVIDENCE_REQUIRED');

  if (plan.mode === 'untimed-text') {
    if (!plan.text?.trim()) reasons.push('DIRECTOR_TRANSCRIPT_TEXT_REQUIRED');
    if (plan.cues?.length) reasons.push('DIRECTOR_TRANSCRIPT_UNTIMED_CUES_FORBIDDEN');
    if (
      policy.maxUntimedDurationMs !== undefined &&
      Number.isFinite(plan.audioDurationMs) &&
      plan.audioDurationMs > policy.maxUntimedDurationMs
    ) reasons.push('DIRECTOR_TRANSCRIPT_UNTIMED_DURATION_EXCEEDED');
    if (policy.requireTimedCues) reasons.push('DIRECTOR_TRANSCRIPT_TIMED_CUES_REQUIRED');
  } else {
    const cues = plan.cues ?? [];
    if (!cues.length) reasons.push('DIRECTOR_TRANSCRIPT_CUES_REQUIRED');
    let previousEnd = -1;
    const ids = new Set<string>();
    for (const cue of cues) {
      if (!cue.id.trim() || ids.has(cue.id)) reasons.push(`DIRECTOR_TRANSCRIPT_CUE_ID_INVALID:${cue.id || 'unknown'}`);
      ids.add(cue.id);
      if (!cue.text.trim()) reasons.push(`DIRECTOR_TRANSCRIPT_CUE_TEXT_REQUIRED:${cue.id}`);
      if (
        !Number.isInteger(cue.startMs) ||
        !Number.isInteger(cue.endMs) ||
        cue.startMs < 0 ||
        cue.endMs <= cue.startMs
      ) reasons.push(`DIRECTOR_TRANSCRIPT_CUE_RANGE_INVALID:${cue.id}`);
      if (cue.startMs < previousEnd) reasons.push(`DIRECTOR_TRANSCRIPT_CUE_OVERLAP:${cue.id}`);
      if (cue.endMs > plan.audioDurationMs) reasons.push(`DIRECTOR_TRANSCRIPT_CUE_OUTSIDE_AUDIO:${cue.id}`);
      if (
        cue.confidence !== undefined &&
        (!Number.isFinite(cue.confidence) || cue.confidence < 0 || cue.confidence > 1)
      ) reasons.push(`DIRECTOR_TRANSCRIPT_CUE_CONFIDENCE_INVALID:${cue.id}`);
      previousEnd = Math.max(previousEnd, cue.endMs);
    }
  }

  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze([...new Set(reasons)]) });
}

export function transcriptText(plan: TranscriptLipSyncPlan): string {
  const decision = validateTranscriptLipSyncPlan(plan);
  if (!decision.valid) {
    throw new Error(`DIRECTOR_TRANSCRIPT_PLAN_INVALID: ${decision.reasons.join(', ')}`);
  }
  return plan.mode === 'untimed-text'
    ? plan.text!.trim()
    : plan.cues!.map(cue => cue.text.trim()).join(' ');
}

export function transcriptPlanEvidence(plan: TranscriptLipSyncPlan): readonly string[] {
  const decision = validateTranscriptLipSyncPlan(plan);
  if (!decision.valid) {
    throw new Error(`DIRECTOR_TRANSCRIPT_PLAN_INVALID: ${decision.reasons.join(', ')}`);
  }
  return Object.freeze([
    `transcript-plan:${plan.id}`,
    `transcript-mode:${plan.mode}`,
    `transcript-language:${plan.language ?? 'unspecified'}`,
    `transcript-cues:${plan.cues?.length ?? 0}`,
    ...plan.evidenceIds,
  ]);
}

function toMilliseconds(parts: number[]): number {
  const [hours, minutes, seconds, milliseconds] = parts;
  if (
    hours === undefined || minutes === undefined || seconds === undefined || milliseconds === undefined ||
    minutes > 59 || seconds > 59
  ) throw new Error('DIRECTOR_TRANSCRIPT_SRT_TIMECODE_INVALID');
  return hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + milliseconds;
}
