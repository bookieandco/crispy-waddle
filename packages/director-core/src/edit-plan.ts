import type { CinematicNote, CinematicNotebook } from './cinematic-notebook';

export type EditOperationKind =
  | 'lut'
  | 'srt-counter'
  | 'motion-background'
  | 'motion-overlay'
  | 'text-highlight'
  | 'map-animation';

export type EditPlanStatus = 'draft' | 'ready' | 'generating' | 'complete' | 'failed';
export type GenerationJobStatus = 'queued' | 'running' | 'complete' | 'failed' | 'cancelled';

export type EditOperation = {
  id: string;
  sourceId: string;
  kind: EditOperationKind;
  startSeconds?: number;
  endSeconds?: number;
  intent: string;
  parameters?: Record<string, unknown>;
  referenceUris?: string[];
  priority?: number;
};

export type EditPlan = {
  id: string;
  title: string;
  version: string;
  status: EditPlanStatus;
  operations: EditOperation[];
  metadata?: Record<string, unknown>;
};

export type GenerationJob = {
  id: string;
  editPlanId: string;
  operationId: string;
  kind: EditOperationKind;
  sourceId: string;
  instructions: string;
  inputRefs: string[];
  outputRefs: string[];
  providerId?: string;
  workflowId?: string;
  status: GenerationJobStatus;
  error?: string;
  metadata?: Record<string, unknown>;
};

export type AssetManifestEntry = {
  id: string;
  generationJobId: string;
  kind: 'image' | 'video' | 'audio' | '3d' | 'motion' | 'lut' | 'subtitle';
  uri: string;
  mimeType: string;
  startSeconds?: number;
  endSeconds?: number;
  metadata?: Record<string, unknown>;
};

export type AssetManifest = {
  id: string;
  editPlanId: string;
  version: string;
  assets: AssetManifestEntry[];
};

const noteKinds: Partial<Record<CinematicNote['kind'], EditOperationKind>> = {
  edit: 'motion-overlay',
  transition: 'motion-background',
};

export function editPlanFromNotebook(notebook: CinematicNotebook, sourceId = notebook.id): EditPlan {
  const operations = notebook.notes
    .filter((note) => note.startSeconds !== undefined || note.endSeconds !== undefined || note.kind === 'edit' || note.kind === 'transition')
    .map((note) => notebookNoteToOperation(note, sourceId));

  return {
    id: `${notebook.id}:edit-plan`,
    title: notebook.title,
    version: '1.0.0',
    status: operations.length ? 'ready' : 'draft',
    operations,
  };
}

export function notebookNoteToOperation(note: CinematicNote, sourceId: string): EditOperation {
  const kind = noteKinds[note.kind] ?? inferOperationKind(note);
  return {
    id: `edit:${note.id}`,
    sourceId,
    kind,
    startSeconds: note.startSeconds,
    endSeconds: note.endSeconds,
    intent: note.body,
    parameters: { title: note.title, tags: note.tags, noteKind: note.kind },
    referenceUris: note.frameUrl ? [note.frameUrl] : [],
  };
}

function inferOperationKind(note: CinematicNote): EditOperationKind {
  const text = `${note.title ?? ''} ${note.body} ${note.tags.join(' ')}`.toLowerCase();
  if (/lut|color grade|colour grade|pastel|teal|skin tone/.test(text)) return 'lut';
  if (/srt|subtitle|caption|counter|count(ing)?|\$/.test(text)) return 'srt-counter';
  if (/background|gradient|glow|orb/.test(text)) return 'motion-background';
  if (/highlight|article|keyword|text/.test(text)) return 'text-highlight';
  if (/map|globe|travel|los angeles|new york/.test(text)) return 'map-animation';
  return 'motion-overlay';
}

export function generationJobsFromEditPlan(plan: EditPlan): GenerationJob[] {
  return plan.operations.map((operation) => ({
    id: `generation:${operation.id}`,
    editPlanId: plan.id,
    operationId: operation.id,
    kind: operation.kind,
    sourceId: operation.sourceId,
    instructions: operation.intent,
    inputRefs: operation.referenceUris ?? [],
    outputRefs: [],
    status: 'queued',
    metadata: operation.parameters,
  }));
}

export function addGeneratedAsset(manifest: AssetManifest, asset: AssetManifestEntry): AssetManifest {
  if (manifest.assets.some((existing) => existing.id === asset.id)) {
    throw new Error(`Asset already registered: ${asset.id}`);
  }
  return { ...manifest, assets: [...manifest.assets, structuredClone(asset)] };
}
