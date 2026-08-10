import type { ContinuityLock, CinematographyPreset } from './generation-orchestrator.js';

export type ContinuityManifest = {
  version: 1;
  projectId: string;
  sceneId: string;
  takeId?: string;
  parentTakeId?: string;
  locks: ContinuityLock[];
  characterIds: string[];
  assetIds: string[];
  cinematography?: CinematographyPreset;
  runtimeSeconds?: number;
  visualNotes?: string[];
  performanceNotes?: string[];
  audioNotes?: string[];
};

export function createContinuityManifest(input: Omit<ContinuityManifest, 'version'>): ContinuityManifest {
  return { version: 1, ...input };
}

export function inheritContinuity(
  previous: ContinuityManifest,
  overrides: Partial<Pick<ContinuityManifest, 'locks' | 'characterIds' | 'assetIds' | 'cinematography' | 'runtimeSeconds' | 'visualNotes' | 'performanceNotes' | 'audioNotes'>>,
): ContinuityManifest {
  return {
    ...previous,
    ...overrides,
    parentTakeId: previous.takeId,
    takeId: undefined,
  };
}
