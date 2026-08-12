import type { DirectorTakeInput, DirectorTakeResult } from './jhadina-adapter.js';

export type CandidateStrategy = 'continuity' | 'performance' | 'camera' | 'timing' | 'comedy' | 'emotion' | 'experimental';

export type CandidatePlan = {
  index: number;
  strategy: CandidateStrategy;
  instruction: string;
};

const strategyInstructions: Record<CandidateStrategy, string> = {
  continuity: 'Preserve the prior take as closely as possible. Only change what the user explicitly requested.',
  performance: 'Keep camera, lighting, wardrobe, blocking and timing stable; explore a stronger actor performance.',
  camera: 'Preserve performance and story intent; explore a subtle alternative camera framing or movement while respecting locked camera controls.',
  timing: 'Preserve the visual setup; explore pacing, pauses and beat timing without changing story meaning.',
  comedy: 'Preserve continuity and story intent; explore the funniest natural performance without breaking character or genre.',
  emotion: 'Preserve the scene structure; explore a stronger emotional read while keeping character purpose consistent.',
  experimental: 'Make one controlled creative departure while preserving all explicit continuity locks.',
};

export function planCandidates(input: DirectorTakeInput & { count?: number; strategies?: CandidateStrategy[] }): CandidatePlan[] {
  const count = Math.max(1, Math.min(8, input.count ?? 3));
  const strategies = input.strategies?.length ? input.strategies : ['continuity', 'performance', 'timing', 'emotion', 'comedy', 'camera', 'experimental'];
  return Array.from({ length: count }, (_, index) => {
    const strategy = strategies[index % strategies.length];
    return { index: index + 1, strategy, instruction: strategyInstructions[strategy] };
  });
}

export function buildCandidateInput(input: DirectorTakeInput, plan: CandidatePlan): DirectorTakeInput {
  const user = input.instruction ? ` User direction: ${input.instruction}` : '';
  return { ...input, instruction: `[Candidate ${plan.index}: ${plan.strategy}] ${plan.instruction}${user}` };
}

export type CandidateResult = DirectorTakeResult & { candidate: CandidatePlan };
