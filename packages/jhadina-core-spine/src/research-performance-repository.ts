import type { ResearchSourcePerformance } from './research-source-performance.js';
import type { ResearchIntentPerformance } from './research-intent-performance.js';

export interface ResearchLearningPolicyRecord {
  policyKey: string;
  policyVersion: number;
  halfLifeDays: number;
  minimumScore: number;
  priorAlpha: number;
  priorBeta: number;
  explorationWeight: number;
  strategy: 'thompson' | 'ucb';
  updatedAt: string;
}

/** Persistence boundary. Implementations may use Supabase, local storage, or another durable store. */
export interface ResearchPerformanceRepository {
  loadPolicy(policyKey?: string): Promise<ResearchLearningPolicyRecord | null>;
  savePolicy(policy: ResearchLearningPolicyRecord): Promise<void>;
  listSourcePerformance(): Promise<readonly ResearchSourcePerformance[]>;
  saveSourcePerformance(value: ResearchSourcePerformance): Promise<void>;
  listIntentPerformance(): Promise<readonly ResearchIntentPerformance[]>;
  saveIntentPerformance(value: ResearchIntentPerformance): Promise<void>;
}

/** Startup hydration contract; learning stores remain independent from persistence. */
export interface ResearchPerformanceHydration {
  policy: ResearchLearningPolicyRecord;
  sourcePerformance: readonly ResearchSourcePerformance[];
  intentPerformance: readonly ResearchIntentPerformance[];
}

export async function hydrateResearchPerformance(
  repository: ResearchPerformanceRepository,
  policyKey = 'default',
): Promise<ResearchPerformanceHydration> {
  const [policy, sourcePerformance, intentPerformance] = await Promise.all([
    repository.loadPolicy(policyKey),
    repository.listSourcePerformance(),
    repository.listIntentPerformance(),
  ]);
  if (!policy) throw new Error(`Research learning policy '${policyKey}' was not found`);
  return { policy, sourcePerformance, intentPerformance };
}
