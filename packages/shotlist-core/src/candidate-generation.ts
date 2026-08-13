import type { DirectorTakeInput, DirectorTakeResult } from './jhadina-adapter.js';
import { createDirectorActionHandlers } from './jhadina-adapter.js';
import type { GenerationAdapter } from './external-adapters.js';

export type CandidateGenerationInput = DirectorTakeInput & { count?: number };
export type CandidateGenerationResult = { candidates: DirectorTakeResult[]; requested: number; generated: number };

/** Generates independent candidate takes while preserving the same scene intent and prior-take context. */
export function createCandidateGenerationHandler(generation: GenerationAdapter) {
  const [generate] = createDirectorActionHandlers(generation);
  return async (input: CandidateGenerationInput): Promise<CandidateGenerationResult> => {
    const requested = Math.min(Math.max(input.count ?? 3, 1), 8);
    const candidates: DirectorTakeResult[] = [];
    for (let index = 0; index < requested; index += 1) {
      candidates.push(await generate.execute({ ...input, instruction: [input.instruction, `Candidate take ${index + 1} of ${requested}. Explore a distinct performance while preserving all locked continuity.`].filter(Boolean).join('\n') }));
    }
    return { candidates, requested, generated: candidates.length };
  };
}
