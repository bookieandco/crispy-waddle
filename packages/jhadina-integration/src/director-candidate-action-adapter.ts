import { createCandidateGenerationHandler, type CandidateGenerationInput, type CandidateGenerationResult, type GenerationAdapter } from '@jhadina/shotlist-core';
import type { ActionAdapter, ExecutionContext } from './action-executor';

export function createDirectorCandidateActionAdapter(generation: GenerationAdapter): ActionAdapter<CandidateGenerationInput, CandidateGenerationResult> {
  const handler = createCandidateGenerationHandler(generation);
  return {
    domain: 'directoros',
    capability: 'take.generateCandidates',
    execute: (input, _context: ExecutionContext) => handler(input),
  };
}
