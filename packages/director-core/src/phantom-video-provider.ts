export type PhantomWanModel = 'phantom-wan-1.3b' | 'phantom-wan-14b';
export type PhantomWanTask = 's2v-1.3B' | 's2v-14B';
export type PhantomWanSize = '832*480' | '1280*720';
export type PhantomGenerationPurpose = 'rehearsal' | 'draft' | 'final-take';
export type PhantomReferenceRole = 'character' | 'product' | 'pet' | 'prop' | 'environment';

export interface PhantomVideoReference {
  id: string;
  role: PhantomReferenceRole;
  assetId: string;
  uri: string;
  sha256: string;
  description: string;
  evidenceIds: readonly string[];
}

export interface PhantomVideoRequest {
  requestId: string;
  projectId: string;
  purpose: PhantomGenerationPurpose;
  model: PhantomWanModel;
  task: PhantomWanTask;
  size: PhantomWanSize;
  fps: 16 | 24;
  frameNum: number;
  seed: number;
  prompt: string;
  references: readonly PhantomVideoReference[];
  sampleSolver: 'unipc' | 'dpm++';
  sampleSteps: number;
  imageGuidanceScale: number;
  textGuidanceScale: number;
  source: {
    repository: 'Phantom-video/Phantom';
    license: 'Apache-2.0';
    maximumReferenceImages: 4;
  };
  stabilityNotes: readonly string[];
  authority: 'DIRECTOR_PHANTOM_REQUEST';
}

export interface BuildPhantomVideoRequestInput {
  requestId: string;
  projectId: string;
  purpose: PhantomGenerationPurpose;
  prompt: string;
  references: readonly PhantomVideoReference[];
  durationSeconds: number;
  seed: number;
  model?: PhantomWanModel;
  size?: PhantomWanSize;
  fps?: 16 | 24;
  sampleSolver?: 'unipc' | 'dpm++';
  sampleSteps?: number;
  imageGuidanceScale?: number;
  textGuidanceScale?: number;
}

export const DIRECTOR_PHANTOM_MAX_REFERENCE_IMAGES = 4;
export const DIRECTOR_PHANTOM_MAX_SHOT_SECONDS = 10;

function modelTask(model: PhantomWanModel): PhantomWanTask {
  return model === 'phantom-wan-14b' ? 's2v-14B' : 's2v-1.3B';
}

function defaultModel(purpose: PhantomGenerationPurpose): PhantomWanModel {
  return purpose === 'final-take' ? 'phantom-wan-14b' : 'phantom-wan-1.3b';
}

function defaultSize(model: PhantomWanModel): PhantomWanSize {
  return model === 'phantom-wan-14b' ? '1280*720' : '832*480';
}

function validateReference(reference: PhantomVideoReference, index: number): string[] {
  const reasons: string[] = [];
  if (!reference.id.trim() || !reference.assetId.trim() || !reference.uri.trim() || !reference.description.trim()) {
    reasons.push(`DIRECTOR_PHANTOM_REFERENCE_INVALID:${index}`);
  }
  if (!/^[a-f0-9]{64}$/i.test(reference.sha256)) reasons.push(`DIRECTOR_PHANTOM_REFERENCE_HASH_INVALID:${index}`);
  if (!reference.evidenceIds.length) reasons.push(`DIRECTOR_PHANTOM_REFERENCE_EVIDENCE_REQUIRED:${index}`);
  return reasons;
}

export function validatePhantomVideoRequest(request: PhantomVideoRequest): readonly string[] {
  const reasons: string[] = [];
  if (!request.requestId.trim() || !request.projectId.trim() || !request.prompt.trim()) {
    reasons.push('DIRECTOR_PHANTOM_IDENTITY_OR_PROMPT_REQUIRED');
  }
  if (request.references.length < 1 || request.references.length > DIRECTOR_PHANTOM_MAX_REFERENCE_IMAGES) {
    reasons.push('DIRECTOR_PHANTOM_REFERENCE_COUNT_INVALID');
  }
  request.references.forEach((reference, index) => reasons.push(...validateReference(reference,index)));
  if (!Number.isInteger(request.seed) || request.seed < 0) reasons.push('DIRECTOR_PHANTOM_SEED_INVALID');
  if (!Number.isInteger(request.frameNum) || request.frameNum < 5 || (request.frameNum - 1) % 4 !== 0) {
    reasons.push('DIRECTOR_PHANTOM_FRAME_NUM_INVALID');
  }
  if (request.fps !== 16 && request.fps !== 24) reasons.push('DIRECTOR_PHANTOM_FPS_INVALID');
  if (request.model === 'phantom-wan-1.3b' && request.size !== '832*480') {
    reasons.push('DIRECTOR_PHANTOM_1_3B_SIZE_UNSUPPORTED');
  }
  if (!Number.isInteger(request.sampleSteps) || request.sampleSteps < 1) reasons.push('DIRECTOR_PHANTOM_SAMPLE_STEPS_INVALID');
  for (const [name,value] of [
    ['image',request.imageGuidanceScale],
    ['text',request.textGuidanceScale],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) reasons.push(`DIRECTOR_PHANTOM_GUIDANCE_INVALID:${name}`);
  }
  return Object.freeze([...new Set(reasons)]);
}

export function buildPhantomVideoRequest(input: BuildPhantomVideoRequestInput): PhantomVideoRequest {
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0 || input.durationSeconds > DIRECTOR_PHANTOM_MAX_SHOT_SECONDS) {
    throw new Error('DIRECTOR_PHANTOM_SHOT_DURATION_INVALID');
  }
  const model = input.model ?? defaultModel(input.purpose);
  const fps = input.fps ?? 24;
  const frameNum = Math.max(5, Math.ceil((input.durationSeconds * fps - 1) / 4) * 4 + 1);
  const size = input.size ?? defaultSize(model);
  const notes: string[] = [];
  if (model === 'phantom-wan-14b' && size === '1280*720') {
    notes.push('Phantom-Wan-14B was trained primarily on 480P data; 720P may be less stable.');
  }
  if (fps === 16) notes.push('24fps is the native Phantom-Wan-14B training cadence; 16fps may reduce quality.');

  const request: PhantomVideoRequest = {
    requestId: input.requestId,
    projectId: input.projectId,
    purpose: input.purpose,
    model,
    task: modelTask(model),
    size,
    fps,
    frameNum,
    seed: input.seed,
    prompt: input.prompt,
    references: Object.freeze(input.references.map((reference) => Object.freeze({ ...reference, evidenceIds:Object.freeze([...reference.evidenceIds]) }))),
    sampleSolver: input.sampleSolver ?? 'unipc',
    sampleSteps: input.sampleSteps ?? 50,
    imageGuidanceScale: input.imageGuidanceScale ?? 5,
    textGuidanceScale: input.textGuidanceScale ?? 7.5,
    source: Object.freeze({
      repository: 'Phantom-video/Phantom',
      license: 'Apache-2.0',
      maximumReferenceImages: DIRECTOR_PHANTOM_MAX_REFERENCE_IMAGES,
    }),
    stabilityNotes: Object.freeze(notes),
    authority: 'DIRECTOR_PHANTOM_REQUEST',
  };
  const reasons = validatePhantomVideoRequest(request);
  if (reasons.length) throw new Error(`DIRECTOR_PHANTOM_REQUEST_INVALID: ${reasons.join(', ')}`);
  return Object.freeze(request);
}

export function phantomCliArguments(request: PhantomVideoRequest, runtime: {
  ckptDir: string;
  phantomCheckpoint: string;
  referencePaths: readonly string[];
  outputPath: string;
}): readonly string[] {
  if (runtime.referencePaths.length !== request.references.length) {
    throw new Error('DIRECTOR_PHANTOM_RUNTIME_REFERENCE_COUNT_MISMATCH');
  }
  if (!runtime.ckptDir.trim() || !runtime.phantomCheckpoint.trim() || !runtime.outputPath.trim()) {
    throw new Error('DIRECTOR_PHANTOM_RUNTIME_PATH_REQUIRED');
  }
  const args = [
    'generate.py',
    '--task', request.task,
    '--size', request.size,
    '--frame_num', String(request.frameNum),
    '--sample_fps', String(request.fps),
    '--ckpt_dir', runtime.ckptDir,
    '--phantom_ckpt', runtime.phantomCheckpoint,
    '--ref_image', runtime.referencePaths.join(','),
    '--prompt', request.prompt,
    '--base_seed', String(request.seed),
    '--sample_solver', request.sampleSolver,
    '--sample_steps', String(request.sampleSteps),
    '--sample_guide_scale_img', String(request.imageGuidanceScale),
    '--sample_guide_scale_text', String(request.textGuidanceScale),
    '--save_file', runtime.outputPath,
  ];
  return Object.freeze(args);
}
