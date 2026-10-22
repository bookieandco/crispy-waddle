/**
 * Director Explainer Studio: deterministic draft planning, not a fact-checker,
 * generative video provider, approval authority, or durable project store.
 */
export type ExplainerStyle = 'minimal' | 'chalkboard' | 'cinematic';
export type ExplainerVoiceDirection = 'warm' | 'energetic' | 'documentary';
export type ExplainerAspect = '9:16' | '16:9' | '1:1';
export type ExplainerPace = 'relaxed' | 'normal' | 'fast';

export interface ExplainerScene {
  readonly id: string;
  readonly index: number;
  readonly role: 'hook' | 'explanation' | 'payoff';
  readonly narration: string;
  readonly visualDirection: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly evidenceRefs: readonly string[];
  readonly verification: 'SOURCE_REVIEW_REQUIRED';
}

export interface ExplainerPlan {
  readonly schemaVersion: 'director.explainer.v1';
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly audience: string;
  readonly style: ExplainerStyle;
  readonly voiceDirection: ExplainerVoiceDirection;
  readonly pace: ExplainerPace;
  readonly aspectRatio: ExplainerAspect;
  readonly captions: boolean;
  readonly durationSeconds: number;
  readonly sourceRefs: readonly string[];
  readonly rightsEvidenceRefs: readonly string[];
  readonly scenes: readonly ExplainerScene[];
  readonly revision: number;
  readonly authority: 'PLANNING_ONLY';
  readonly mediaAuthority: 'PREVIEW_ONLY';
  readonly publicationAuthority: 'NONE';
}

export interface ExplainerInput {
  id: string;
  projectId: string;
  title: string;
  audience: string;
  script: string;
  style: ExplainerStyle;
  voiceDirection: ExplainerVoiceDirection;
  pace: ExplainerPace;
  aspectRatio: ExplainerAspect;
  captions: boolean;
  durationSeconds: number;
  sourceRefs?: readonly string[];
  rightsEvidenceRefs?: readonly string[];
}

const STYLES: readonly ExplainerStyle[] = ['minimal', 'chalkboard', 'cinematic'];
const VOICES: readonly ExplainerVoiceDirection[] = ['warm', 'energetic', 'documentary'];
const PACES: readonly ExplainerPace[] = ['relaxed', 'normal', 'fast'];
const ASPECTS: readonly ExplainerAspect[] = ['9:16', '16:9', '1:1'];
const WORD_LIMIT = 1600;
const MAX_SCENES = 24;

function nonEmpty(input: unknown, code: string): string {
  if (typeof input !== 'string' || !input.trim()) throw new Error(code);
  return input.trim();
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function references(values: readonly string[] | undefined, code: string): readonly string[] {
  if (!values) return Object.freeze([]);
  if (!Array.isArray(values) || values.some(value => typeof value !== 'string' || !value.trim())) {
    throw new Error(code);
  }
  return Object.freeze([...new Set(values.map(value => value.trim()))]);
}

/** Never invent factual narration or citations: only reflow owner supplied script. */
function segmentScript(script: string): string[] {
  const sentences = script.replace(/\r/g, '').split(/\n{2,}|(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
  const scenes: string[] = [];
  let pending = '';
  for (const sentence of sentences) {
    const chunks = sentence.match(/\S+(?:\s+|$)/g) ?? [sentence];
    // Hard cap per scene, including very long single-sentence narrations.
    for (let cursor = 0; cursor < chunks.length; cursor += 32) {
      const chunk = chunks.slice(cursor, cursor + 32).join('').trim();
      if (!chunk) continue;
      if (pending && wordCount(pending + ' ' + chunk) > 32) {
        scenes.push(pending);
        pending = '';
      }
      pending = pending ? pending + ' ' + chunk : chunk;
    }
  }
  if (pending) scenes.push(pending);
  if (!scenes.length || scenes.length > MAX_SCENES) throw new Error('DIRECTOR_EXPLAINER_SCENE_COUNT_INVALID');
  return scenes;
}

function visualSeed(narration: string, style: ExplainerStyle): string {
  const subject = narration.split(/\s+/).slice(0, 14).join(' ');
  return (style === 'minimal' ? 'Clean geometric shapes, legible kinetic labels' :
    style === 'chalkboard' ? 'Hand-drawn lines, diagrams and stepwise reveals' :
    'Layered depth, subtle camera movement and illustrative light') + '. Illustrate only this supplied narration: ' + subject;
}

function reflow(plan: ExplainerPlan, scenes: readonly ExplainerScene[]): ExplainerPlan {
  if (!scenes.length || scenes.length > MAX_SCENES) throw new Error('DIRECTOR_EXPLAINER_SCENE_COUNT_INVALID');
  const totalWords = scenes.reduce((sum, scene) => sum + Math.max(1, wordCount(scene.narration)), 0);
  let elapsedMs = 0;
  const durationMs = Math.round(plan.durationSeconds * 1000);
  const allocated = scenes.map((scene, i) => {
    const remaining = durationMs - elapsedMs;
    const raw = i === scenes.length - 1 ? remaining : Math.round(durationMs * Math.max(1, wordCount(scene.narration)) / totalWords);
    const ms = Math.max(1, Math.min(raw, remaining - (scenes.length - i - 1)));
    const startSeconds = elapsedMs / 1000;
    elapsedMs += ms;
    return Object.freeze({
      ...scene,
      index: i + 1,
      role: i === 0 ? 'hook' as const : i === scenes.length - 1 ? 'payoff' as const : 'explanation' as const,
      startSeconds,
      endSeconds: elapsedMs / 1000,
      evidenceRefs: Object.freeze([...scene.evidenceRefs]),
      verification: 'SOURCE_REVIEW_REQUIRED' as const,
    });
  });
  return Object.freeze({ ...plan, scenes: Object.freeze(allocated) });
}

export function createExplainerPlan(input: ExplainerInput): ExplainerPlan {
  const id = nonEmpty(input.id, 'DIRECTOR_EXPLAINER_ID_REQUIRED');
  const projectId = nonEmpty(input.projectId, 'DIRECTOR_EXPLAINER_PROJECT_REQUIRED');
  const title = nonEmpty(input.title, 'DIRECTOR_EXPLAINER_TITLE_REQUIRED');
  const audience = nonEmpty(input.audience, 'DIRECTOR_EXPLAINER_AUDIENCE_REQUIRED');
  const script = nonEmpty(input.script, 'DIRECTOR_EXPLAINER_SCRIPT_REQUIRED');
  if (wordCount(script) < 5 || wordCount(script) > WORD_LIMIT) throw new Error('DIRECTOR_EXPLAINER_SCRIPT_LENGTH_INVALID');
  if (!STYLES.includes(input.style) || !VOICES.includes(input.voiceDirection) || !PACES.includes(input.pace) || !ASPECTS.includes(input.aspectRatio)) {
    throw new Error('DIRECTOR_EXPLAINER_PROFILE_INVALID');
  }
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 10 || input.durationSeconds > 300) {
    throw new Error('DIRECTOR_EXPLAINER_DURATION_INVALID');
  }
  if (typeof input.captions !== 'boolean') throw new Error('DIRECTOR_EXPLAINER_CAPTIONS_INVALID');
  const sourceRefs = references(input.sourceRefs, 'DIRECTOR_EXPLAINER_SOURCES_INVALID');
  const rightsEvidenceRefs = references(input.rightsEvidenceRefs, 'DIRECTOR_EXPLAINER_RIGHTS_INVALID');
  if (sourceRefs.length && !rightsEvidenceRefs.length) throw new Error('DIRECTOR_EXPLAINER_RIGHTS_REQUIRED');
  const initial: ExplainerPlan = Object.freeze({
    schemaVersion: 'director.explainer.v1', id, projectId, title, audience,
    style: input.style, voiceDirection: input.voiceDirection, pace: input.pace,
    aspectRatio: input.aspectRatio, captions: input.captions,
    durationSeconds: input.durationSeconds, sourceRefs, rightsEvidenceRefs,
    scenes: Object.freeze([]), revision: 1,
    authority: 'PLANNING_ONLY', mediaAuthority: 'PREVIEW_ONLY', publicationAuthority: 'NONE',
  });
  const segments = segmentScript(script);
  return reflow(initial, segments.map((narration, index) => ({
    id: id + ':scene:' + (index + 1), index: index + 1,
    role: 'explanation' as const,
    narration, visualDirection: visualSeed(narration, input.style),
    startSeconds: 0, endSeconds: 0, evidenceRefs: sourceRefs,
    verification: 'SOURCE_REVIEW_REQUIRED' as const,
  })));
}

/**
 * Conversational editing is intentionally a limited explicit command grammar.
 * Unknown instructions fail closed instead of pretending an AI completed them.
 */
export function directExplainerRevision(plan: ExplainerPlan, direction: string): ExplainerPlan {
  const command = nonEmpty(direction, 'DIRECTOR_EXPLAINER_DIRECTION_REQUIRED');
  if (command.length > 3000) throw new Error('DIRECTOR_EXPLAINER_DIRECTION_TOO_LONG');
  const sceneEdit = command.match(/^scene\s+(\d+)\s+(narration|visual)\s*:\s*([\s\S]+)$/i);
  if (sceneEdit) {
    const index = Number(sceneEdit[1]) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= plan.scenes.length) throw new Error('DIRECTOR_EXPLAINER_SCENE_NOT_FOUND');
    const content = nonEmpty(sceneEdit[3], 'DIRECTOR_EXPLAINER_SCENE_EDIT_EMPTY');
    if (content.length > 1500) throw new Error('DIRECTOR_EXPLAINER_SCENE_EDIT_TOO_LONG');
    const scenes = plan.scenes.map((scene, i) => i !== index ? scene : ({
      ...scene,
      [sceneEdit[2].toLowerCase() === 'visual' ? 'visualDirection' : 'narration']: content,
    }));
    return reflow({ ...plan, revision: plan.revision + 1 }, scenes);
  }
  const setting = command.match(/^(style|voice|pace|format|captions|duration|audience)\s*:?\s+([\s\S]+)$/i);
  if (!setting) throw new Error('DIRECTOR_EXPLAINER_DIRECTION_UNSUPPORTED');
  const key = setting[1].toLowerCase();
  const value = setting[2].trim().toLowerCase();
  const next = { ...plan, revision: plan.revision + 1 };
  if (key === 'style' && STYLES.includes(value as ExplainerStyle)) {
    return Object.freeze({ ...next, style: value as ExplainerStyle });
  }
  if (key === 'voice' && VOICES.includes(value as ExplainerVoiceDirection)) return Object.freeze({ ...next, voiceDirection: value as ExplainerVoiceDirection });
  if (key === 'pace' && PACES.includes(value as ExplainerPace)) return Object.freeze({ ...next, pace: value as ExplainerPace });
  if (key === 'format' && ASPECTS.includes(value as ExplainerAspect)) return Object.freeze({ ...next, aspectRatio: value as ExplainerAspect });
  if (key === 'captions' && ['on', 'off'].includes(value)) return Object.freeze({ ...next, captions: value === 'on' });
  if (key === 'audience' && value.length <= 250) return Object.freeze({ ...next, audience: setting[2].trim() });
  if (key === 'duration') {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 10 && n <= 300) return reflow({ ...next, durationSeconds: n }, plan.scenes);
  }
  throw new Error('DIRECTOR_EXPLAINER_DIRECTION_INVALID');
}

export function explainerSrt(plan: ExplainerPlan): string {
  const stamp = (seconds: number) => {
    const ms = Math.round(seconds * 1000);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor(ms / 60000) % 60;
    const s = Math.floor(ms / 1000) % 60;
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':') + ',' + String(ms % 1000).padStart(3, '0');
  };
  return plan.scenes.map((scene, i) => String(i + 1) + '\n' + stamp(scene.startSeconds) + ' --> ' + stamp(scene.endSeconds) + '\n' + scene.narration.replace(/\s+/g, ' ') + '\n').join('\n');
}

/** Social handoff is a pending draft; only canonical reviewed media can enter Social approval. */
export function proposeExplainerSocialDraft(plan: ExplainerPlan, input: {
  approvedDirectorAssetId: string;
  assetApprovalReceiptId: string;
  finalQcEvidenceRefs: readonly string[];
  targetPlatform: string;
}) {
  const approvedDirectorAssetId = nonEmpty(input.approvedDirectorAssetId, 'DIRECTOR_EXPLAINER_SOCIAL_ASSET_REQUIRED');
  const assetApprovalReceiptId = nonEmpty(input.assetApprovalReceiptId, 'DIRECTOR_EXPLAINER_SOCIAL_APPROVAL_REQUIRED');
  const targetPlatform = nonEmpty(input.targetPlatform, 'DIRECTOR_EXPLAINER_SOCIAL_PLATFORM_REQUIRED');
  const finalQcEvidenceRefs = references(input.finalQcEvidenceRefs, 'DIRECTOR_EXPLAINER_SOCIAL_QC_INVALID');
  if (!finalQcEvidenceRefs.length) throw new Error('DIRECTOR_EXPLAINER_SOCIAL_QC_REQUIRED');
  if (!plan.rightsEvidenceRefs.length) throw new Error('DIRECTOR_EXPLAINER_SOCIAL_RIGHTS_REQUIRED');
  return Object.freeze({
    kind: 'director.explainer.social-draft.v1' as const,
    directorProjectId: plan.projectId,
    approvedDirectorAssetId,
    assetApprovalReceiptId,
    finalQcEvidenceRefs,
    rightsEvidenceRefs: plan.rightsEvidenceRefs,
    platform: targetPlatform,
    aspectRatio: plan.aspectRatio,
    suggestedText: plan.title,
    status: 'PENDING_CANONICAL_SOCIAL_HANDOFF' as const,
    publicationAuthority: 'NONE' as const,
    paidMediaAuthority: 'NONE' as const,
  });
}
