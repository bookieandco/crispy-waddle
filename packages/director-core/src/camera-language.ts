export type CameraExecutionTarget = 'generative-video' | 'virtual-camera' | 'physical-camera';

export type CameraShotSize =
  | 'extreme-close-up'
  | 'close-up'
  | 'medium-close-up'
  | 'medium'
  | 'cowboy'
  | 'full'
  | 'wide'
  | 'extreme-wide'
  | 'insert'
  | 'custom';

export type CameraAngle =
  | 'eye-level'
  | 'high'
  | 'low'
  | 'overhead'
  | 'ground-level'
  | 'dutch'
  | 'profile'
  | 'over-shoulder'
  | 'pov'
  | 'custom';

export type CameraMovementKind =
  | 'locked'
  | 'pan'
  | 'tilt'
  | 'dolly-in'
  | 'dolly-out'
  | 'truck'
  | 'pedestal'
  | 'orbit'
  | 'tracking'
  | 'handheld'
  | 'whip-pan'
  | 'zoom-in'
  | 'zoom-out'
  | 'crash-zoom'
  | 'snap-reframe'
  | 'pov-travel'
  | 'drone'
  | 'custom';

export type CameraMovementIntensity = 'minimal' | 'low' | 'medium' | 'high';

export type CameraFormApproach = 'realist' | 'formalist' | 'hybrid';

export type CameraCompositionBalance = 'balanced' | 'intentionally-unbalanced' | 'symmetrical' | 'asymmetrical' | 'custom';
export type CameraGridStrategy = 'rule-of-thirds' | 'golden-triangle' | 'centered' | 'free' | 'custom';
export type CameraLeadRoom = 'ample' | 'balanced' | 'short-sided' | 'custom';
export type CameraHeadroom = 'ample' | 'balanced' | 'tight' | 'custom';

export type CameraLeadingLine = {
  source: string;
  target: string;
  purpose?: string;
  evidenceRefs?: string[];
};

export type CameraFocalPoint = {
  target: string;
  priority: number;
  placement?: string;
  purpose?: string;
  evidenceRefs?: string[];
};

export type CameraFrameWithinFrame = {
  source: string;
  target: string;
  shape?: 'rectangle' | 'circle' | 'triangle' | 'arch' | 'custom';
  purpose?: string;
  evidenceRefs?: string[];
};

export type CameraDepthLayer = {
  layer: 'foreground' | 'midground' | 'background';
  content: string;
  focusState?: 'sharp' | 'soft' | 'silhouette' | 'custom';
  purpose?: string;
  evidenceRefs?: string[];
};

export type CameraAttentionCue = {
  kind: 'color' | 'luminance-contrast' | 'focus' | 'size' | 'isolation' | 'custom';
  target: string;
  description: string;
  evidenceRefs?: string[];
};

export type CameraCompositionRuleBreak = {
  rule: string;
  purpose: string;
  evidenceRefs: string[];
};

export type CameraVector3 = {
  x: number;
  y: number;
  z: number;
};

export type CameraIntent = {
  /** What this shot must accomplish in the story, not a style adjective. */
  narrativeFunction: string;
  /** Intended audience effect, used as evidence for the chosen camera behavior. */
  emotionalEffect?: string;
  /** Primary visual attention target. */
  attentionTarget?: string;
  energy?: 'still' | 'low' | 'medium' | 'high';
  realism?: 'observational' | 'grounded' | 'stylized';
  /** Realist/formalist are interpretive film-form approaches, not physical realism settings. */
  formApproach?: CameraFormApproach;
  /** Optional authored meaning; Director must not infer this automatically from a trope alone. */
  symbolicIntent?: string[];
};

export type CameraComposition = {
  shotSize: CameraShotSize;
  angle?: CameraAngle;
  framing?: string;
  subjectPlacement?: string;
  horizon?: 'low' | 'eye-level' | 'high' | 'custom';
  vanishingPoint?: string;
  negativeSpace?: string;
  balance?: CameraCompositionBalance;
  gridStrategy?: CameraGridStrategy;
  subjectGridPlacement?: string;
  symmetryAxis?: 'vertical' | 'horizontal' | 'radial' | 'custom';
  leadRoom?: CameraLeadRoom;
  headroom?: CameraHeadroom;
  shortSide?: boolean;
  leadingLines?: CameraLeadingLine[];
  focalPoints?: CameraFocalPoint[];
  frameWithinFrame?: CameraFrameWithinFrame[];
  depthLayers?: CameraDepthLayer[];
  attentionCues?: CameraAttentionCue[];
  intentionalRuleBreaks?: CameraCompositionRuleBreak[];
};

export type CameraOptics = {
  focalLengthMm?: number;
  lensFeel?: string;
  focus?: string;
  depthOfField?: string;
  fovDegrees?: number;
};

export type CameraMovementInstruction = {
  kind: CameraMovementKind;
  intensity?: CameraMovementIntensity;
  direction?: string;
  speed?: string;
  target?: string;
  path?: string;
  stabilization?: 'locked' | 'tripod' | 'gimbal' | 'shoulder' | 'handheld' | 'custom';
  /**
   * Required for moving shots. Director should be able to explain why the
   * camera moves before delegating execution to a model, engine or operator.
   */
  motivation?: string;
};

export type CameraFocusEvent = {
  /** Event or performance beat that motivates the focus change. */
  trigger: string;
  fromTarget?: string;
  toTarget: string;
  transitionSeconds?: number;
  holdSeconds?: number;
};

export type CameraTiming = {
  durationSeconds?: number;
  oneTake?: boolean;
  bpm?: number;
  beatSubdivision?: 1 | 2 | 4 | 8;
  startAnchor?: string;
  landingAnchor?: string;
};

export type CameraCaptureSettings = {
  fps?: number;
  width?: number;
  height?: number;
  hdr?: boolean;
  zoomFactor?: number;
  focusMode?: 'auto' | 'manual' | 'locked';
  exposureMode?: 'auto' | 'manual' | 'locked';
  exposureSeconds?: number;
  iso?: number;
  torch?: boolean;
  frameProcessing?: boolean;
};

export type CameraKeyframe = {
  timeSeconds: number;
  position?: CameraVector3;
  lookAt?: CameraVector3;
  rotationDegrees?: CameraVector3;
  focalLengthMm?: number;
  fovDegrees?: number;
};

export type DirectorCameraPlan = {
  version: 1;
  target: CameraExecutionTarget;
  intent: CameraIntent;
  composition: CameraComposition;
  optics?: CameraOptics;
  movements: CameraMovementInstruction[];
  focusEvents?: CameraFocusEvent[];
  timing?: CameraTiming;
  capture?: CameraCaptureSettings;
  keyframes?: CameraKeyframe[];
  /** Explicit camera properties that must survive retries, edits and handoffs. */
  preserve?: Array<
    | 'shot-size'
    | 'angle'
    | 'framing'
    | 'movement'
    | 'lens'
    | 'focus'
    | 'exposure'
    | 'camera-position'
    | 'timing'
  >;
  /** Evidence/notes/reference frames that justify the plan without becoming authority. */
  evidenceRefs?: string[];
};

export type CameraProviderCapabilities = {
  providerId: string;
  targets: CameraExecutionTarget[];
  movementKinds?: CameraMovementKind[];
  capture?: {
    fps?: { min: number; max: number };
    maxWidth?: number;
    maxHeight?: number;
    hdr?: boolean;
    manualFocus?: boolean;
    manualExposure?: boolean;
    manualIso?: boolean;
    torch?: boolean;
    frameProcessing?: boolean;
    zoom?: { min: number; max: number };
  };
};

export type CameraPlanIssueSeverity = 'error' | 'warning';

export type CameraPlanIssue = {
  code:
    | 'MISSING_NARRATIVE_FUNCTION'
    | 'LOCKED_WITH_MOVEMENT'
    | 'UNMOTIVATED_MOVEMENT'
    | 'TOO_MANY_MOVEMENTS'
    | 'INVALID_FOCAL_LENGTH'
    | 'INVALID_FOV'
    | 'INVALID_DURATION'
    | 'INVALID_BPM'
    | 'INVALID_FOCUS_EVENT'
    | 'FOCUS_EVENT_REQUIRED'
    | 'INVALID_CAPTURE_FPS'
    | 'INVALID_CAPTURE_SIZE'
    | 'INVALID_CAPTURE_ZOOM'
    | 'INVALID_CAPTURE_EXPOSURE'
    | 'INVALID_CAPTURE_ISO'
    | 'INVALID_KEYFRAME_TIME'
    | 'INVALID_COMPOSITION'
    | 'KEYFRAME_OUT_OF_RANGE'
    | 'UNSORTED_KEYFRAMES'
    | 'UNSUPPORTED_TARGET'
    | 'UNSUPPORTED_MOVEMENT'
    | 'UNSUPPORTED_CAPTURE_SETTING';
  severity: CameraPlanIssueSeverity;
  path: string;
  message: string;
};

export function validateDirectorCameraPlan(
  plan: DirectorCameraPlan,
  capabilities?: CameraProviderCapabilities,
): CameraPlanIssue[] {
  const issues: CameraPlanIssue[] = [];

  if (!plan.intent.narrativeFunction.trim()) {
    issues.push(issue('MISSING_NARRATIVE_FUNCTION', 'error', 'intent.narrativeFunction', 'Camera intent needs a concrete narrative function.'));
  }

  const locked = plan.movements.filter((movement) => movement.kind === 'locked');
  if (locked.length > 0 && plan.movements.length > locked.length) {
    issues.push(issue('LOCKED_WITH_MOVEMENT', 'error', 'movements', 'A locked camera cannot also contain an active camera move in the same shot.'));
  }

  plan.movements.forEach((movement, index) => {
    if (movement.kind !== 'locked' && !movement.motivation?.trim()) {
      issues.push(issue(
        'UNMOTIVATED_MOVEMENT',
        'error',
        `movements[${index}].motivation`,
        `Movement "${movement.kind}" needs a shot-specific motivation.`,
      ));
    }
  });

  if (plan.movements.length > 3) {
    issues.push(issue(
      'TOO_MANY_MOVEMENTS',
      'warning',
      'movements',
      'More than three camera moves in one shot can dilute the primary visual instruction; prefer a smaller motivated set or split the shot.',
    ));
  }

  const focalLength = plan.optics?.focalLengthMm;
  if (focalLength !== undefined && (!Number.isFinite(focalLength) || focalLength <= 0)) {
    issues.push(issue('INVALID_FOCAL_LENGTH', 'error', 'optics.focalLengthMm', 'Focal length must be a positive finite number.'));
  }

  const fov = plan.optics?.fovDegrees;
  if (fov !== undefined && (!Number.isFinite(fov) || fov <= 0 || fov >= 180)) {
    issues.push(issue('INVALID_FOV', 'error', 'optics.fovDegrees', 'Field of view must be greater than 0 and less than 180 degrees.'));
  }

  const duration = plan.timing?.durationSeconds;
  if (duration !== undefined && (!Number.isFinite(duration) || duration <= 0)) {
    issues.push(issue('INVALID_DURATION', 'error', 'timing.durationSeconds', 'Shot duration must be a positive finite number.'));
  }

  const bpm = plan.timing?.bpm;
  if (bpm !== undefined && (!Number.isFinite(bpm) || bpm <= 0)) {
    issues.push(issue('INVALID_BPM', 'error', 'timing.bpm', 'BPM must be a positive finite number.'));
  }

  validateComposition(plan.composition, issues);
  validateFocusEvents(plan.focusEvents, issues);
  validateCapture(plan.capture, issues);
  validateKeyframes(plan, issues);

  if (capabilities) validateAgainstCapabilities(plan, capabilities, issues);

  return issues;
}

export function assertDirectorCameraPlan(
  plan: DirectorCameraPlan,
  capabilities?: CameraProviderCapabilities,
): DirectorCameraPlan {
  const errors = validateDirectorCameraPlan(plan, capabilities).filter((candidate) => candidate.severity === 'error');
  if (errors.length > 0) {
    throw new Error(`DIRECTOR_CAMERA_PLAN_INVALID: ${errors.map((candidate) => `${candidate.code}@${candidate.path}`).join(', ')}`);
  }
  return plan;
}

/**
 * Produces a compact, provider-neutral directive from the structured plan.
 * Provider adapters may translate this further, but cannot silently override it.
 */
export function compileDirectorCameraDirective(plan: DirectorCameraPlan): string {
  assertDirectorCameraPlan(plan);

  const parts: string[] = [
    `Narrative function: ${plan.intent.narrativeFunction.trim()}`,
    `Shot: ${[plan.composition.shotSize, plan.composition.angle, plan.composition.framing].filter(Boolean).join(', ')}`,
  ];

  const composition = [
    plan.composition.subjectPlacement && `subject ${plan.composition.subjectPlacement}`,
    plan.composition.horizon && `${plan.composition.horizon} horizon`,
    plan.composition.vanishingPoint && `vanishing point ${plan.composition.vanishingPoint}`,
    plan.composition.negativeSpace && `negative space ${plan.composition.negativeSpace}`,
    plan.composition.balance && `${plan.composition.balance} balance`,
    plan.composition.gridStrategy && `${plan.composition.gridStrategy} composition`,
    plan.composition.subjectGridPlacement && `grid placement ${plan.composition.subjectGridPlacement}`,
    plan.composition.symmetryAxis && `symmetry axis ${plan.composition.symmetryAxis}`,
    plan.composition.leadRoom && `lead room ${plan.composition.leadRoom}`,
    plan.composition.headroom && `headroom ${plan.composition.headroom}`,
    plan.composition.shortSide===true && 'short-side the subject',
    plan.composition.leadingLines?.length && `leading lines ${plan.composition.leadingLines.map(line=>`${line.source} -> ${line.target}${line.purpose?` (${line.purpose})`:''}`).join(' | ')}`,
    plan.composition.focalPoints?.length && `focal points ${[...plan.composition.focalPoints].sort((a,b)=>a.priority-b.priority).map(point=>`#${point.priority} ${point.target}${point.placement?` at ${point.placement}`:''}${point.purpose?` (${point.purpose})`:''}`).join(' | ')}`,
    plan.composition.frameWithinFrame?.length && `frame-within-frame ${plan.composition.frameWithinFrame.map(frame=>`${frame.source} frames ${frame.target}${frame.shape?` as ${frame.shape}`:''}${frame.purpose?` (${frame.purpose})`:''}`).join(' | ')}`,
    plan.composition.depthLayers?.length && `depth layers ${plan.composition.depthLayers.map(layer=>`${layer.layer}: ${layer.content}${layer.focusState?` [${layer.focusState}]`:''}${layer.purpose?` (${layer.purpose})`:''}`).join(' | ')}`,
    plan.composition.attentionCues?.length && `attention cues ${plan.composition.attentionCues.map(cue=>`${cue.kind} -> ${cue.target}: ${cue.description}`).join(' | ')}`,
    plan.composition.intentionalRuleBreaks?.length && `intentional rule breaks ${plan.composition.intentionalRuleBreaks.map(item=>`${item.rule} because ${item.purpose}`).join(' | ')}`,
  ].filter(Boolean);
  if (composition.length) parts.push(`Composition: ${composition.join('; ')}`);

  const optics = [
    plan.optics?.focalLengthMm !== undefined && `${formatNumber(plan.optics.focalLengthMm)}mm`,
    plan.optics?.lensFeel,
    plan.optics?.focus,
    plan.optics?.depthOfField,
    plan.optics?.fovDegrees !== undefined && `${formatNumber(plan.optics.fovDegrees)}° FOV`,
  ].filter(Boolean);
  if (optics.length) parts.push(`Optics: ${optics.join(', ')}`);

  if (plan.movements.length > 0) {
    parts.push(`Movement: ${plan.movements.map(compileMovement).join(' | ')}`);
  }

  if (plan.focusEvents?.length) {
    parts.push(`Focus events: ${plan.focusEvents.map(compileFocusEvent).join(' | ')}`);
  }

  const timing = [
    plan.timing?.durationSeconds !== undefined && `${formatNumber(plan.timing.durationSeconds)}s`,
    plan.timing?.oneTake === true && 'one take',
    plan.timing?.bpm !== undefined && `${formatNumber(plan.timing.bpm)} BPM`,
    plan.timing?.beatSubdivision !== undefined && `1/${plan.timing.beatSubdivision} beat grid`,
    plan.timing?.startAnchor && `start on ${plan.timing.startAnchor}`,
    plan.timing?.landingAnchor && `land on ${plan.timing.landingAnchor}`,
  ].filter(Boolean);
  if (timing.length) parts.push(`Timing: ${timing.join(', ')}`);

  if (plan.intent.attentionTarget) parts.push(`Attention: ${plan.intent.attentionTarget}`);
  if (plan.intent.emotionalEffect) parts.push(`Audience effect: ${plan.intent.emotionalEffect}`);
  if (plan.intent.formApproach) parts.push(`Film-form approach: ${plan.intent.formApproach}`);
  if (plan.intent.symbolicIntent?.length) parts.push(`Symbolic intent: ${plan.intent.symbolicIntent.join(' | ')}`);
  if (plan.preserve?.length) parts.push(`Preserve: ${plan.preserve.join(', ')}`);

  return parts.join('\n');
}

export function beatDurationSeconds(bpm: number, subdivision = 1): number {
  if (!Number.isFinite(bpm) || bpm <= 0) throw new Error('DIRECTOR_CAMERA_INVALID_BPM');
  if (!Number.isFinite(subdivision) || subdivision <= 0) throw new Error('DIRECTOR_CAMERA_INVALID_BEAT_SUBDIVISION');
  return 60 / bpm / subdivision;
}

export function framesPerBeat(fps: number, bpm: number, subdivision = 1): number {
  if (!Number.isFinite(fps) || fps <= 0) throw new Error('DIRECTOR_CAMERA_INVALID_FPS');
  return fps * beatDurationSeconds(bpm, subdivision);
}

function compileFocusEvent(event: CameraFocusEvent): string {
  const timing = [
    event.transitionSeconds !== undefined && `transition ${formatNumber(event.transitionSeconds)}s`,
    event.holdSeconds !== undefined && `hold ${formatNumber(event.holdSeconds)}s`,
  ].filter(Boolean).join(', ');
  return [
    `when ${event.trigger}`,
    event.fromTarget && `from ${event.fromTarget}`,
    `to ${event.toTarget}`,
    timing || undefined,
  ].filter(Boolean).join('; ');
}

function compileMovement(movement: CameraMovementInstruction): string {
  const details = [
    movement.intensity && `${movement.intensity} intensity`,
    movement.direction,
    movement.speed,
    movement.target && `target ${movement.target}`,
    movement.path && `path ${movement.path}`,
    movement.stabilization && `${movement.stabilization} stabilization`,
    movement.motivation && `because ${movement.motivation}`,
  ].filter(Boolean);
  return details.length ? `${movement.kind} (${details.join('; ')})` : movement.kind;
}

function validateComposition(composition: CameraComposition, issues: CameraPlanIssue[]): void {
  if (composition.balance === 'symmetrical' && !composition.symmetryAxis) {
    issues.push(issue(
      'INVALID_COMPOSITION',
      'warning',
      'composition.symmetryAxis',
      'Symmetrical composition should identify the intended symmetry axis when known.',
    ));
  }

  if (
    (composition.gridStrategy === 'rule-of-thirds' || composition.gridStrategy === 'golden-triangle') &&
    !composition.subjectGridPlacement?.trim()
  ) {
    issues.push(issue(
      'INVALID_COMPOSITION',
      'warning',
      'composition.subjectGridPlacement',
      'Grid-based composition should record the intended subject/focal placement when known.',
    ));
  }

  for (const [index, point] of (composition.focalPoints ?? []).entries()) {
    if (!point.target.trim() || !Number.isInteger(point.priority) || point.priority < 1) {
      issues.push(issue(
        'INVALID_COMPOSITION',
        'error',
        `composition.focalPoints[${index}]`,
        'Focal points require a target and a positive integer priority.',
      ));
    }
  }
  const focalPriorities = (composition.focalPoints ?? []).map(point => point.priority);
  if (new Set(focalPriorities).size !== focalPriorities.length) {
    issues.push(issue(
      'INVALID_COMPOSITION',
      'error',
      'composition.focalPoints',
      'Focal-point priorities must be unique so the attention order is unambiguous.',
    ));
  }

  for (const [index, frame] of (composition.frameWithinFrame ?? []).entries()) {
    if (!frame.source.trim() || !frame.target.trim()) {
      issues.push(issue(
        'INVALID_COMPOSITION',
        'error',
        `composition.frameWithinFrame[${index}]`,
        'Frame-within-frame instructions require both the framing source and target.',
      ));
    }
  }

  const layerNames = (composition.depthLayers ?? []).map(layer => layer.layer);
  if (new Set(layerNames).size !== layerNames.length) {
    issues.push(issue(
      'INVALID_COMPOSITION',
      'error',
      'composition.depthLayers',
      'Depth layers may define foreground, midground and background at most once each.',
    ));
  }
  for (const [index, layer] of (composition.depthLayers ?? []).entries()) {
    if (!layer.content.trim()) {
      issues.push(issue(
        'INVALID_COMPOSITION',
        'error',
        `composition.depthLayers[${index}]`,
        'Depth layers require visible content.',
      ));
    }
  }

  for (const [index, cue] of (composition.attentionCues ?? []).entries()) {
    if (!cue.target.trim() || !cue.description.trim()) {
      issues.push(issue(
        'INVALID_COMPOSITION',
        'error',
        `composition.attentionCues[${index}]`,
        'Attention cues require a target and a description of how the frame directs the eye.',
      ));
    }
  }

  for (const [index, ruleBreak] of (composition.intentionalRuleBreaks ?? []).entries()) {
    if (!ruleBreak.rule.trim() || !ruleBreak.purpose.trim() || !ruleBreak.evidenceRefs.length) {
      issues.push(issue(
        'INVALID_COMPOSITION',
        'error',
        `composition.intentionalRuleBreaks[${index}]`,
        'Intentional composition rule breaks require the broken convention, purpose, and evidence.',
      ));
    }
  }

  if (
    composition.balance === 'intentionally-unbalanced' &&
    !(composition.intentionalRuleBreaks?.length)
  ) {
    issues.push(issue(
      'INVALID_COMPOSITION',
      'error',
      'composition.intentionalRuleBreaks',
      'An intentionally unbalanced frame must state why that imbalance serves the shot.',
    ));
  }

  for (const [index, line] of (composition.leadingLines ?? []).entries()) {
    if (!line.source.trim() || !line.target.trim()) {
      issues.push(issue(
        'INVALID_COMPOSITION',
        'error',
        `composition.leadingLines[${index}]`,
        'Leading-line instructions require both a source line and an attention target.',
      ));
    }
  }
}

function validateFocusEvents(events: CameraFocusEvent[] | undefined, issues: CameraPlanIssue[]): void {
  if (!events) return;
  events.forEach((event, index) => {
    if (!event.trigger.trim() || !event.toTarget.trim()) {
      issues.push(issue(
        'FOCUS_EVENT_REQUIRED',
        'error',
        `focusEvents[${index}]`,
        'Focus events require both a trigger and a destination focus target.',
      ));
    }
    if (
      (event.transitionSeconds !== undefined && (!Number.isFinite(event.transitionSeconds) || event.transitionSeconds < 0)) ||
      (event.holdSeconds !== undefined && (!Number.isFinite(event.holdSeconds) || event.holdSeconds < 0))
    ) {
      issues.push(issue(
        'INVALID_FOCUS_EVENT',
        'error',
        `focusEvents[${index}]`,
        'Focus event transition/hold durations must be non-negative finite numbers.',
      ));
    }
  });
}

function validateCapture(capture: CameraCaptureSettings | undefined, issues: CameraPlanIssue[]): void {
  if (!capture) return;
  if (capture.fps !== undefined && (!Number.isFinite(capture.fps) || capture.fps <= 0)) {
    issues.push(issue('INVALID_CAPTURE_FPS', 'error', 'capture.fps', 'Capture FPS must be a positive finite number.'));
  }
  if (
    (capture.width !== undefined && (!Number.isInteger(capture.width) || capture.width <= 0)) ||
    (capture.height !== undefined && (!Number.isInteger(capture.height) || capture.height <= 0))
  ) {
    issues.push(issue('INVALID_CAPTURE_SIZE', 'error', 'capture', 'Capture width and height must be positive integers.'));
  }
  if (capture.zoomFactor !== undefined && (!Number.isFinite(capture.zoomFactor) || capture.zoomFactor <= 0)) {
    issues.push(issue('INVALID_CAPTURE_ZOOM', 'error', 'capture.zoomFactor', 'Zoom factor must be a positive finite number.'));
  }
  if (capture.exposureSeconds !== undefined && (!Number.isFinite(capture.exposureSeconds) || capture.exposureSeconds <= 0)) {
    issues.push(issue('INVALID_CAPTURE_EXPOSURE', 'error', 'capture.exposureSeconds', 'Exposure time must be a positive finite number.'));
  }
  if (capture.iso !== undefined && (!Number.isFinite(capture.iso) || capture.iso <= 0)) {
    issues.push(issue('INVALID_CAPTURE_ISO', 'error', 'capture.iso', 'ISO must be a positive finite number.'));
  }
}

function validateKeyframes(plan: DirectorCameraPlan, issues: CameraPlanIssue[]): void {
  if (!plan.keyframes?.length) return;

  let previous = -Infinity;
  plan.keyframes.forEach((keyframe, index) => {
    if (!Number.isFinite(keyframe.timeSeconds) || keyframe.timeSeconds < 0) {
      issues.push(issue('INVALID_KEYFRAME_TIME', 'error', `keyframes[${index}].timeSeconds`, 'Keyframe time must be a non-negative finite number.'));
      return;
    }

    if (keyframe.timeSeconds < previous) {
      issues.push(issue('UNSORTED_KEYFRAMES', 'error', `keyframes[${index}].timeSeconds`, 'Camera keyframes must be ordered by time.'));
    }
    previous = keyframe.timeSeconds;

    if (plan.timing?.durationSeconds !== undefined && keyframe.timeSeconds > plan.timing.durationSeconds) {
      issues.push(issue('KEYFRAME_OUT_OF_RANGE', 'error', `keyframes[${index}].timeSeconds`, 'Camera keyframe lies after the end of the shot.'));
    }

    if (keyframe.focalLengthMm !== undefined && (!Number.isFinite(keyframe.focalLengthMm) || keyframe.focalLengthMm <= 0)) {
      issues.push(issue('INVALID_FOCAL_LENGTH', 'error', `keyframes[${index}].focalLengthMm`, 'Keyframe focal length must be a positive finite number.'));
    }

    if (keyframe.fovDegrees !== undefined && (!Number.isFinite(keyframe.fovDegrees) || keyframe.fovDegrees <= 0 || keyframe.fovDegrees >= 180)) {
      issues.push(issue('INVALID_FOV', 'error', `keyframes[${index}].fovDegrees`, 'Keyframe field of view must be greater than 0 and less than 180 degrees.'));
    }
  });
}

function validateAgainstCapabilities(
  plan: DirectorCameraPlan,
  capabilities: CameraProviderCapabilities,
  issues: CameraPlanIssue[],
): void {
  if (!capabilities.targets.includes(plan.target)) {
    issues.push(issue('UNSUPPORTED_TARGET', 'error', 'target', `Provider ${capabilities.providerId} does not support target ${plan.target}.`));
  }

  if (capabilities.movementKinds) {
    plan.movements.forEach((movement, index) => {
      if (!capabilities.movementKinds!.includes(movement.kind)) {
        issues.push(issue(
          'UNSUPPORTED_MOVEMENT',
          'error',
          `movements[${index}].kind`,
          `Provider ${capabilities.providerId} does not support movement ${movement.kind}.`,
        ));
      }
    });
  }

  const capture = plan.capture;
  const supported = capabilities.capture;
  if (!capture || !supported) return;

  if (capture.fps !== undefined && supported.fps && (capture.fps < supported.fps.min || capture.fps > supported.fps.max)) {
    issues.push(issue('UNSUPPORTED_CAPTURE_SETTING', 'error', 'capture.fps', `Provider ${capabilities.providerId} cannot capture at ${capture.fps} FPS.`));
  }
  if (capture.width !== undefined && supported.maxWidth !== undefined && capture.width > supported.maxWidth) {
    issues.push(issue('UNSUPPORTED_CAPTURE_SETTING', 'error', 'capture.width', `Provider ${capabilities.providerId} max width is ${supported.maxWidth}.`));
  }
  if (capture.height !== undefined && supported.maxHeight !== undefined && capture.height > supported.maxHeight) {
    issues.push(issue('UNSUPPORTED_CAPTURE_SETTING', 'error', 'capture.height', `Provider ${capabilities.providerId} max height is ${supported.maxHeight}.`));
  }
  if (capture.hdr === true && supported.hdr === false) {
    issues.push(issue('UNSUPPORTED_CAPTURE_SETTING', 'error', 'capture.hdr', `Provider ${capabilities.providerId} does not support HDR capture.`));
  }
  if (capture.focusMode === 'manual' && supported.manualFocus === false) {
    issues.push(issue('UNSUPPORTED_CAPTURE_SETTING', 'error', 'capture.focusMode', `Provider ${capabilities.providerId} does not support manual focus.`));
  }
  if ((capture.exposureMode === 'manual' || capture.exposureSeconds !== undefined) && supported.manualExposure === false) {
    issues.push(issue('UNSUPPORTED_CAPTURE_SETTING', 'error', 'capture.exposureMode', `Provider ${capabilities.providerId} does not support manual exposure.`));
  }
  if (capture.iso !== undefined && supported.manualIso === false) {
    issues.push(issue('UNSUPPORTED_CAPTURE_SETTING', 'error', 'capture.iso', `Provider ${capabilities.providerId} does not support manual ISO.`));
  }
  if (capture.torch === true && supported.torch === false) {
    issues.push(issue('UNSUPPORTED_CAPTURE_SETTING', 'error', 'capture.torch', `Provider ${capabilities.providerId} does not expose torch control.`));
  }
  if (capture.frameProcessing === true && supported.frameProcessing === false) {
    issues.push(issue('UNSUPPORTED_CAPTURE_SETTING', 'error', 'capture.frameProcessing', `Provider ${capabilities.providerId} does not expose frame processing.`));
  }
  if (
    capture.zoomFactor !== undefined &&
    supported.zoom &&
    (capture.zoomFactor < supported.zoom.min || capture.zoomFactor > supported.zoom.max)
  ) {
    issues.push(issue(
      'UNSUPPORTED_CAPTURE_SETTING',
      'error',
      'capture.zoomFactor',
      `Provider ${capabilities.providerId} zoom range is ${supported.zoom.min}-${supported.zoom.max}.`,
    ));
  }
}

function issue(
  code: CameraPlanIssue['code'],
  severity: CameraPlanIssueSeverity,
  path: string,
  message: string,
): CameraPlanIssue {
  return { code, severity, path, message };
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}
