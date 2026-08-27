import { emitPrompts, type PromptContext } from './emit.js';
import type { DirectorTasteProfile } from './director-taste.js';
import type { GenerationAdapter, TouchUpAdapter } from './external-adapters.js';
import type { Entity, ReferenceAsset, Shot } from './types.js';
import { buildDirectorGenerationContext, mergeDirectorGenerationControls } from './director-generation-context.js';
import type { DirectorDecisionContext } from './director-decision-context.js';
import type { ExperiencePort } from '../../jhadina-core-spine/src/experience.js';
import { recordGeneratedDirectorTakeExperience } from './director-take-experience.js';

export interface DirectorTakeInput {
  projectId: string; shot: Shot; entities?: Entity[]; refs?: ReferenceAsset[]; instruction?: string;
  directorTaste?: DirectorTasteProfile; decisionContext?: DirectorDecisionContext;
  priorTake?: { takeId: string; clipUri: string; provider: string; notes?: string };
}
export interface DirectorTakeResult {
  takeId: string; shotId: string; assetIds: string[]; clipUri: string; provider: string; prompts: Record<string, string>;
  continuity: { priorTakeId?: string; instruction?: string };
  recipe: { prompts: Record<string, string>; controls: Shot['director']; priorTake?: DirectorTakeInput['priorTake'] };
}
export interface DirectorActionHandler { domain: 'directoros'; capability: 'take.generate' | 'take.regenerate'; execute(input: DirectorTakeInput): Promise<DirectorTakeResult>; }

function buildPromptContext(input: DirectorTakeInput): PromptContext {
  const continuity = input.priorTake ? `Maintain continuity with prior take ${input.priorTake.takeId}. Prior clip: ${input.priorTake.clipUri}. ${input.priorTake.notes ?? ''}` : undefined;
  const instruction = input.instruction ? `User direction: ${input.instruction}` : undefined;
  const decision = buildDirectorGenerationContext(input);
  const controls = mergeDirectorGenerationControls(input.shot.director, decision);
  const decisionNotes = decision?.promptNotes?.join(' ');
  const decisionInstruction = decisionNotes ? `Jhadina directing guidance: ${decisionNotes}` : undefined;
  return { shot: { ...input.shot, director: controls, action: [input.shot.action, continuity, instruction, decisionInstruction].filter(Boolean).join('\n') }, entities: input.entities, refs: input.refs, directorTaste: input.directorTaste ?? input.decisionContext?.taste };
}

export function createDirectorActionHandlers(generation: GenerationAdapter, persistence?: { experiences: ExperiencePort; ownerId: string }): DirectorActionHandler[] {
  const generate = async (input: DirectorTakeInput): Promise<DirectorTakeResult> => {
    const ctx = buildPromptContext(input);
    const prompts = emitPrompts(ctx);
    const provider = generation.name;
    const renderedPrompt = prompts[provider] ?? prompts.seedance ?? Object.values(prompts)[0];
    if (!renderedPrompt) throw new Error('Shotlist Core emitted no provider prompt.');
    const clip = await generation.generateClip(ctx, renderedPrompt);
    const takeId = crypto.randomUUID();
    const result: DirectorTakeResult = { takeId, shotId: input.shot.id, assetIds: [clip.shotId], clipUri: clip.uri, provider: clip.provider, prompts, continuity: { priorTakeId: input.priorTake?.takeId, instruction: input.instruction }, recipe: { prompts, controls: ctx.shot.director, priorTake: input.priorTake } };
    if (persistence) await recordGeneratedDirectorTakeExperience({ takeId, shotId: result.shotId, clipUri: result.clipUri, provider: result.provider, occurredAt: new Date().toISOString(), projectId: input.projectId, controls: result.recipe.controls }, persistence.experiences, persistence.ownerId);
    return result;
  };
  return [
    { domain: 'directoros', capability: 'take.generate', execute: generate },
    { domain: 'directoros', capability: 'take.regenerate', execute: generate },
  ];
}

export function createDirectorTouchUpHandler(touchUp: TouchUpAdapter) {
  return async (clipUri: string, shot: Shot, regionHint: string, instruction: string) => touchUp.touchUp({ shotId: shot.id, uri: clipUri, provider: touchUp.name, durationSec: shot.durationSec }, regionHint, instruction);
}
