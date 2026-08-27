import type { DirectorTakeInput } from './jhadina-adapter.js';
import type { DirectorControls } from './types.js';
import { buildDirectorDecisionGuidance, type DirectorDecisionContext } from './director-decision-context.js';

export interface DirectorGenerationContext {
  controls: DirectorControls;
  promptNotes: string[];
  tone: string;
  jokePermission: number;
  creativeRisk: number;
}

export function buildDirectorGenerationContext(input: DirectorTakeInput & { decisionContext?: DirectorDecisionContext }): DirectorGenerationContext | undefined {
  if (!input.decisionContext) return undefined;
  const guidance = buildDirectorDecisionGuidance(input.decisionContext);
  return guidance;
}

export function mergeDirectorGenerationControls(
  base: DirectorControls,
  guidance?: DirectorGenerationContext,
): DirectorControls {
  if (!guidance) return base;
  return { ...guidance.controls, ...base };
}
