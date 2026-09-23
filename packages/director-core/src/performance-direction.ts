export type PerformanceEnergy = 'restrained' | 'low' | 'medium' | 'high' | 'explosive';
export type PerformancePace = 'very-slow' | 'slow' | 'measured' | 'natural' | 'quick' | 'rapid';
export type PerformanceBeatKind =
  | 'action'
  | 'reaction'
  | 'dialogue'
  | 'pause'
  | 'breath'
  | 'gaze'
  | 'gesture'
  | 'blocking'
  | 'focus-trigger';

export type DialogueAccentDirection = {
  locale?: string;
  region?: string;
  description: string;
  /** Prevents caricature/exaggeration when the intent is naturalistic. */
  naturalism?: 'natural' | 'heightened' | 'stylized';
};

export type PerformanceBeat = {
  id: string;
  kind: PerformanceBeatKind;
  startSeconds?: number;
  endSeconds?: number;
  trigger?: string;
  actorId?: string;
  action?: string;
  emotionalState?: string;
  bodyState?: string;
  gazeTarget?: string;
  breath?: string;
  pauseSeconds?: number;
  line?: string;
  pace?: PerformancePace;
  energy?: PerformanceEnergy;
  accent?: DialogueAccentDirection;
  /** Observable end-state that downstream QC can inspect. */
  endState?: string;
};

export type PerformanceDirectionPlan = {
  version: 1;
  sceneFunction: string;
  continuousTake?: boolean;
  actors: Array<{
    actorId: string;
    characterId?: string;
    startingState?: string;
    endingState?: string;
    performanceRule?: string;
  }>;
  beats: PerformanceBeat[];
  preserve?: Array<
    | 'identity'
    | 'voice-identity'
    | 'wardrobe'
    | 'blocking'
    | 'original-motion'
    | 'original-dialogue'
    | 'timing'
  >;
  evidenceRefs?: string[];
};

export type PerformanceDirectionIssue = {
  code:
    | 'SCENE_FUNCTION_REQUIRED'
    | 'ACTOR_REQUIRED'
    | 'BEAT_REQUIRED'
    | 'DIALOGUE_LINE_REQUIRED'
    | 'INVALID_BEAT_RANGE'
    | 'INVALID_PAUSE'
    | 'UNSORTED_BEATS'
    | 'UNKNOWN_ACTOR'
    | 'TRIGGER_WITHOUT_ACTION'
    | 'END_STATE_REQUIRED';
  path: string;
  message: string;
};

export function validatePerformanceDirectionPlan(plan: PerformanceDirectionPlan): PerformanceDirectionIssue[] {
  const issues: PerformanceDirectionIssue[] = [];

  if (!plan.sceneFunction.trim()) {
    issues.push(issue('SCENE_FUNCTION_REQUIRED', 'sceneFunction', 'Performance direction needs a concrete scene function.'));
  }
  if (!plan.actors.length) {
    issues.push(issue('ACTOR_REQUIRED', 'actors', 'At least one actor is required.'));
  }
  if (!plan.beats.length) {
    issues.push(issue('BEAT_REQUIRED', 'beats', 'At least one observable performance beat is required.'));
  }

  const actorIds = new Set(plan.actors.map((actor) => actor.actorId));
  let previousStart = -Infinity;

  plan.beats.forEach((beat, index) => {
    if (beat.actorId && !actorIds.has(beat.actorId)) {
      issues.push(issue('UNKNOWN_ACTOR', `beats[${index}].actorId`, `Unknown actor: ${beat.actorId}`));
    }

    if (beat.kind === 'dialogue' && !beat.line?.trim()) {
      issues.push(issue('DIALOGUE_LINE_REQUIRED', `beats[${index}].line`, 'Dialogue beats require the exact spoken line.'));
    }

    if (
      beat.startSeconds !== undefined &&
      (!Number.isFinite(beat.startSeconds) || beat.startSeconds < 0)
    ) {
      issues.push(issue('INVALID_BEAT_RANGE', `beats[${index}].startSeconds`, 'Beat start must be a non-negative finite number.'));
    }
    if (
      beat.endSeconds !== undefined &&
      (!Number.isFinite(beat.endSeconds) || beat.endSeconds < 0 || (
        beat.startSeconds !== undefined && beat.endSeconds <= beat.startSeconds
      ))
    ) {
      issues.push(issue('INVALID_BEAT_RANGE', `beats[${index}].endSeconds`, 'Beat end must be after its start.'));
    }

    if (beat.pauseSeconds !== undefined && (!Number.isFinite(beat.pauseSeconds) || beat.pauseSeconds < 0)) {
      issues.push(issue('INVALID_PAUSE', `beats[${index}].pauseSeconds`, 'Pause duration must be a non-negative finite number.'));
    }

    if (beat.startSeconds !== undefined) {
      if (beat.startSeconds < previousStart) {
        issues.push(issue('UNSORTED_BEATS', `beats[${index}].startSeconds`, 'Timed performance beats must be ordered by start time.'));
      }
      previousStart = beat.startSeconds;
    }

    if (beat.trigger && !beat.action && !beat.line && !beat.breath && !beat.gazeTarget) {
      issues.push(issue('TRIGGER_WITHOUT_ACTION', `beats[${index}]`, 'A trigger needs an observable response.'));
    }

    if (
      (beat.kind === 'action' || beat.kind === 'reaction' || beat.kind === 'dialogue') &&
      !beat.endState?.trim()
    ) {
      issues.push(issue('END_STATE_REQUIRED', `beats[${index}].endState`, 'Major performance beats need an observable end state for continuity/QC.'));
    }
  });

  return issues;
}

export function assertPerformanceDirectionPlan(plan: PerformanceDirectionPlan): PerformanceDirectionPlan {
  const issues = validatePerformanceDirectionPlan(plan);
  if (issues.length) {
    throw new Error(`DIRECTOR_PERFORMANCE_PLAN_INVALID: ${issues.map((candidate) => `${candidate.code}@${candidate.path}`).join(', ')}`);
  }
  return plan;
}

export function compilePerformanceDirective(plan: PerformanceDirectionPlan): string {
  assertPerformanceDirectionPlan(plan);

  const lines = [
    `Scene function: ${plan.sceneFunction.trim()}`,
    plan.continuousTake ? 'Performance continuity: continuous take' : undefined,
  ].filter(Boolean) as string[];

  for (const actor of plan.actors) {
    const state = [
      actor.startingState && `start ${actor.startingState}`,
      actor.endingState && `end ${actor.endingState}`,
      actor.performanceRule,
    ].filter(Boolean);
    if (state.length) lines.push(`Actor ${actor.actorId}: ${state.join('; ')}`);
  }

  for (const beat of plan.beats) {
    const timing = beat.startSeconds !== undefined
      ? beat.endSeconds !== undefined
        ? `${format(beat.startSeconds)}-${format(beat.endSeconds)}s`
        : `@${format(beat.startSeconds)}s`
      : 'untimed';

    const detail = [
      beat.actorId && `actor ${beat.actorId}`,
      beat.trigger && `after/when ${beat.trigger}`,
      beat.action,
      beat.emotionalState && `emotion ${beat.emotionalState}`,
      beat.bodyState && `body ${beat.bodyState}`,
      beat.gazeTarget && `gaze ${beat.gazeTarget}`,
      beat.breath && `breath ${beat.breath}`,
      beat.pauseSeconds !== undefined && `pause ${format(beat.pauseSeconds)}s`,
      beat.line && `say exactly: "${beat.line}"`,
      beat.pace && `pace ${beat.pace}`,
      beat.energy && `energy ${beat.energy}`,
      beat.accent && `voice/accent ${compileAccent(beat.accent)}`,
      beat.endState && `end state ${beat.endState}`,
    ].filter(Boolean);

    lines.push(`Beat ${beat.id} [${timing}; ${beat.kind}]: ${detail.join('; ')}`);
  }

  if (plan.preserve?.length) lines.push(`Preserve performance: ${plan.preserve.join(', ')}`);
  return lines.join('\n');
}

function compileAccent(accent: DialogueAccentDirection): string {
  return [
    accent.region,
    accent.locale,
    accent.description,
    accent.naturalism && `${accent.naturalism} delivery`,
  ].filter(Boolean).join(', ');
}

function issue(
  code: PerformanceDirectionIssue['code'],
  path: string,
  message: string,
): PerformanceDirectionIssue {
  return { code, path, message };
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}
