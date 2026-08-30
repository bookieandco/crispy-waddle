export interface SceneValidationAction {
  readonly id: string;
  readonly type?: 'action' | 'delay' | 'assert-state';
  readonly capability?: string;
  readonly payload?: unknown;
  readonly milliseconds?: number;
}

export interface SceneValidationLimits {
  readonly maxActions: number;
  readonly maxDelayMs: number;
  readonly maxRuntimeMs: number;
  readonly maxPayloadBytes: number;
}

export interface SceneValidationInput {
  readonly id: string;
  readonly version: number;
  readonly actions: readonly SceneValidationAction[];
  readonly estimatedRuntimeMs?: number;
}

export interface SceneValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export const DEFAULT_SCENE_VALIDATION_LIMITS: SceneValidationLimits = Object.freeze({
  maxActions: 100,
  maxDelayMs: 30_000,
  maxRuntimeMs: 5 * 60_000,
  maxPayloadBytes: 16_384,
});

function payloadBytes(value: unknown): number {
  if (value === undefined) return 0;
  try { return new TextEncoder().encode(JSON.stringify(value)).byteLength; } catch { return Number.POSITIVE_INFINITY; }
}

export function validateScene(scene: SceneValidationInput, limits: SceneValidationLimits = DEFAULT_SCENE_VALIDATION_LIMITS): SceneValidationResult {
  const errors: string[] = [];
  if (!scene.id || !/^[A-Za-z0-9._:-]+$/.test(scene.id)) errors.push('invalid scene id');
  if (!Number.isInteger(scene.version) || scene.version < 1) errors.push('invalid scene version');
  if (scene.actions.length > limits.maxActions) errors.push('action limit exceeded');
  if ((scene.estimatedRuntimeMs ?? 0) > limits.maxRuntimeMs) errors.push('runtime limit exceeded');

  const seen = new Set<string>();
  for (const action of scene.actions) {
    if (!action.id || seen.has(action.id)) errors.push(`duplicate or missing action id: ${action.id || '<missing>'}`);
    seen.add(action.id);
    if (payloadBytes(action.payload) > limits.maxPayloadBytes) errors.push(`payload limit exceeded: ${action.id}`);
    if (action.type === 'delay') {
      if (!Number.isInteger(action.milliseconds) || action.milliseconds < 0) errors.push(`invalid delay: ${action.id}`);
      else if (action.milliseconds > limits.maxDelayMs) errors.push(`delay limit exceeded: ${action.id}`);
    }
    if (action.type !== 'delay' && action.type !== 'assert-state' && !action.capability) errors.push(`missing capability: ${action.id}`);
    if (action.type === 'assert-state' && !action.payload) errors.push(`missing state assertion: ${action.id}`);
  }
  return { valid: errors.length === 0, errors };
}
