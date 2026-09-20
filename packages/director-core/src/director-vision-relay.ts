export type VisionStation = 'vision' | 'communication' | 'prep' | 'shoot' | 'review';

export interface DirectorVision {
  id: string;
  projectId: string;
  logline?: string;
  themes: string[];
  references: string[];
  visualLanguage: string[];
  cameraLanguage: string[];
  editorialIntent: string[];
  constraints: string[];
  updatedAt: string;
}

export interface DirectorTreatment {
  id: string;
  visionId: string;
  title: string;
  synopsis: string;
  tone: string[];
  visualReferences: string[];
  cameraApproach: string[];
  movement: string[];
  lighting: string[];
  color: string[];
  editRhythm: string[];
  soundDirection: string[];
  approved: boolean;
  version: number;
}

export interface VisionHandoff {
  from: VisionStation;
  to: VisionStation;
  sourceVersion: number;
  artifactIds: string[];
  invariants: string[];
}

export function createVisionHandoff(
  from: VisionStation,
  to: VisionStation,
  sourceVersion: number,
  artifactIds: string[],
  invariants: string[],
): VisionHandoff {
  if (sourceVersion < 1) throw new Error('Vision version must be >= 1');
  return { from, to, sourceVersion, artifactIds: [...artifactIds], invariants: [...invariants] };
}
