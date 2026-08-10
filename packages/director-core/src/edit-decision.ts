import type { ContinuityManifest } from './continuity-manifest.js';

export type FavoriteTake = {
  takeId: string;
  clipUri: string;
  sceneId: string;
  order?: number;
  notes?: string;
  manifest?: ContinuityManifest;
};

export type EditDecision = {
  id: string;
  projectId: string;
  sceneId: string;
  sourceTakeIds: string[];
  instruction: string;
  preserveContinuity: boolean;
  generativeEdits: GenerativeEdit[];
  createdAt: string;
};

export type GenerativeEdit = {
  id: string;
  sourceTakeId: string;
  operation: 'trim' | 'extend' | 'replace' | 'remove' | 'insert' | 'reframe' | 'retime' | 'fill';
  instruction: string;
  startSeconds?: number;
  endSeconds?: number;
};

export function buildEditDecision(input: Omit<EditDecision, 'id' | 'createdAt'>): EditDecision {
  return { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
}

export function buildAssemblyBrief(favorites: FavoriteTake[], instruction: string) {
  return {
    instruction,
    preserveContinuity: true,
    sources: favorites
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((take) => ({ takeId: take.takeId, sceneId: take.sceneId, clipUri: take.clipUri, notes: take.notes })),
  };
}
