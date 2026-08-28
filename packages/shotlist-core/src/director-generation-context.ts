import type { DirectorTakeInput } from './jhadina-adapter.js';
import type { DirectorControls } from './types.js';
import { buildDirectorDecisionGuidance, type DirectorDecisionContext } from './director-decision-context.js';
import { resolveDirectorDecision } from './director-decision-resolver.js';

export interface DirectorGenerationContext {
  controls: DirectorControls;
  promptNotes: string[];
  tone: string;
  jokePermission: number;
  creativeRisk: number;
  sources: ReturnType<typeof resolveDirectorDecision>['sources'];
}

export function buildDirectorGenerationContext(input: DirectorTakeInput & { decisionContext?: DirectorDecisionContext }): DirectorGenerationContext | undefined {
  if (!input.decisionContext) return undefined;
  const guidance = buildDirectorDecisionGuidance(input.decisionContext);
  const behavior = {
    mode: input.decisionContext.mode === 'focused' ? 'normal' : input.decisionContext.mode,
    sliders: input.decisionContext.sliders,
    domain: 'directoros',
  } as any;
  const decision = resolveDirectorDecision({
    explicit: input.shot.director,
    defaults: {},
    taste: input.decisionContext.taste,
    behavior,
    situation: {
      storyIntent: input.decisionContext.storyIntent as any,
      emotionalWeight: input.decisionContext.mode === 'sensitive' || input.decisionContext.mode === 'serious' ? 90 : 0,
    },
  });
  return { ...guidance, controls: decision.controls, sources: decision.sources };
}

export function mergeDirectorGenerationControls(
  base: DirectorControls,
  guidance?: DirectorGenerationContext,
): DirectorControls {
  if (!guidance) return base;
  return { ...guidance.controls, ...base };
}
