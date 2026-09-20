import type { ContinuityLock } from './generation-orchestrator.js';

/** Canonical continuity state carried forward from an approved take. */
export type ContinuityManifest = {
  takeId: string;
  locked: ContinuityLock[];
  values: Partial<Record<ContinuityLock, string>>;
  version?: number;
};

export function createContinuityManifest(input: {
  takeId: string;
  locked: ContinuityLock[];
  values?: Partial<Record<ContinuityLock, string>>;
  version?: number;
}): ContinuityManifest {
  return {
    takeId: input.takeId,
    locked: [...input.locked],
    values: { ...(input.values ?? {}) },
    version: input.version,
  };
}
