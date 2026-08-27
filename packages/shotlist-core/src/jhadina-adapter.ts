import { emitPrompts, type PromptContext } from './emit.js';
import type { DirectorTasteProfile } from './director-taste.js';
import type { GenerationAdapter, TouchUpAdapter } from './external-adapters.js';
import type { Entity, ReferenceAsset, Shot } from './types.js';

export interface DirectorTakeInput {
  projectId: string;
  shot: Shot;
  entities?: Entity[];
  refs?: ReferenceAsset[];
  instruction?: string;
  directorTaste?: DirectorTasteProfile;
  priorTake?: { takeId: string; clipUri: string; provider: string; notes?: string };
}

export interface DirectorTakeResult {
  takeId: string;
  shotId: string;
  assetIds: string[];
  clipUri: string;
  provider: string;
  prompts: Record<string, string>;
  continuity: { priorTakeId?: string; instruction?: string };
  recipe: { prompts: Record<string, string>; controls: Shot['director']; priorTake?: DirectorTakeInput['priorTake'] };
}

export interface DirectorActionHandler {
  domain: 'directoros';
  capability: 'take.generate' | 'take.regenerate';
  execute(input: DirectorTakeInput): Promise<DirectorTakeResult>;
}

function buildPromptContext(input: DirectorTakeInput): PromptContext {
  const continuity = input.priorTake
    ? `Maintain continuity with prior take ${input.priorTake.takeId}. Prior clip: ${input.priorTake.clipUri}. ${input.priorTake.notes ?? ''}`
    : undefined;
  const instruction = input.instruction ? `User direction: ${input.instruction}` : undefined;
  return {
    shot: { ...input.shot, action: [input.shot.action, continuity, instruction].filter(Boolean).join('\n') },
    entities: input.entities,
    refs: input.refs,
    directorTaste: input.directorTaste,
  };
}

export function createDirectorActionHandlers(generation: GenerationAdapter): DirectorActionHandler[] {
  const generate = async (input: DirectorTakeInput): Promise<DirectorTakeResult> => {
    const ctx = buildPromptContext(input);
    const prompts = emitPrompts(ctx);
    const provider = generation.name;
    const renderedPrompt = prompts[provider] ?? prompts.seedance ?? Object.values(prompts)[0];
    if (!renderedPrompt) throw new Error('Shotlist Core emitted no provider prompt.');
    const clip = await generation.generateClip(ctx, renderedPrompt);
    return {
      takeId: crypto.randomUUID(),
      shotId: input.shot.id,
      assetIds: [clip.shotId],
      clipUri: clip.uri,
      provider: clip.provider,
      prompts,
      continuity: { priorTakeId: input.priorTake?.takeId, instruction: input.instruction },
      recipe: { prompts, controls: input.shot.director, priorTake: input.priorTake },
    };
  };

  return [
    { domain: 'directoros', capability: 'take.generate', execute: generate },
    { domain: 'directoros', capability: 'take.regenerate', execute: generate },
  ];
}

export function createDirectorTouchUpHandler(touchUp: TouchUpAdapter) {
  return async (clipUri: string, shot: Shot, regionHint: string, instruction: string) => {
    const result = await touchUp.touchUp({ shotId: shot.id, uri: clipUri, provider: touchUp.name, durationSec: shot.durationSec }, regionHint, instruction);
    return result;
  };
}
