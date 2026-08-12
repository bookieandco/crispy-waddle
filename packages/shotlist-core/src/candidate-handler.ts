import type { DirectorTakeInput, DirectorTakeResult } from './jhadina-adapter.js';
import { buildCandidateInput, planCandidates, type CandidatePlan, type CandidateResult } from './candidate-planner.js';

export type CandidateGeneration = (input: DirectorTakeInput) => Promise<DirectorTakeResult>;

export async function generateCandidateTakes(
  input: DirectorTakeInput & { count?: number; strategies?: CandidatePlan['strategy'][] },
  generate: CandidateGeneration,
): Promise<CandidateResult[]> {
  const plans = planCandidates(input);
  return Promise.all(plans.map(async (candidate) => ({
    ...(await generate(buildCandidateInput(input, candidate))),
    candidate,
  })));
}
