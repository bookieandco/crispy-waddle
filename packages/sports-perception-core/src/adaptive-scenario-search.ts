import type { Sport } from './contracts.js';

export type AdaptiveObjectiveKind = 'EXPECTED_VALUE' | 'WORST_CASE' | 'ROBUSTNESS' | 'DIVERSITY' | 'UNCERTAINTY';

export interface ScenarioGenome {
  scenarioId: string;
  sport: Sport;
  genes: Readonly<Record<string, number>>;
  parentScenarioIds: readonly string[];
  generation: number;
}

export interface ScenarioEvaluation {
  scenarioId: string;
  objectives: Readonly<Record<AdaptiveObjectiveKind, number>>;
  fitness: number;
  outcomeDistribution?: Readonly<Record<string, number>>;
  evidenceIds: readonly string[];
  simulationIds: readonly string[];
}

export interface AdaptiveSearchConfig {
  populationSize: number;
  generations: number;
  eliteCount: number;
  mutationRate: number;
  mutationScale: number;
  diversityWeight: number;
  seed: number;
}

export interface AdaptiveSearchResult {
  runId: string;
  generation: number;
  population: readonly ScenarioGenome[];
  evaluations: readonly ScenarioEvaluation[];
  archive: readonly ScenarioGenome[];
  seed: number;
}

export interface AdaptiveScenarioEvaluator {
  evaluate(scenario: ScenarioGenome): ScenarioEvaluation;
}

export interface AdaptiveScenarioOperator {
  crossover(left: ScenarioGenome, right: ScenarioGenome, scenarioId: string, rng: RandomSource): ScenarioGenome;
  mutate(parent: ScenarioGenome, scenarioId: string, rng: RandomSource, scale: number): ScenarioGenome;
}

export interface RandomSource {
  next(): number;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

class SeededRandom implements RandomSource {
  private state: number;
  constructor(seed: number) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Adaptive search seed must be an unsigned 32-bit integer');
    this.state = seed >>> 0;
  }
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

function stableGenes(genes: Readonly<Record<string, number>>): string {
  return Object.keys(genes).sort().map((key) => `${key}:${genes[key]}`).join('|');
}

function validateGenome(scenario: ScenarioGenome): void {
  if (!scenario.scenarioId.trim() || !scenario.sport) throw new Error('Adaptive scenario identity is required');
  if (!Number.isInteger(scenario.generation) || scenario.generation < 0) throw new Error('Adaptive scenario generation must be non-negative');
  for (const [key, value] of Object.entries(scenario.genes)) {
    if (!key.trim() || !Number.isFinite(value)) throw new Error('Adaptive scenario genes must contain finite numeric values');
  }
}

function validateConfig(config: AdaptiveSearchConfig): void {
  if (!Number.isInteger(config.populationSize) || config.populationSize < 2) throw new Error('Population size must be at least 2');
  if (!Number.isInteger(config.generations) || config.generations < 1) throw new Error('Generations must be positive');
  if (!Number.isInteger(config.eliteCount) || config.eliteCount < 1 || config.eliteCount > config.populationSize) throw new Error('Elite count must be within the population');
  if (!Number.isFinite(config.mutationRate) || config.mutationRate < 0 || config.mutationRate > 1) throw new Error('Mutation rate must be within [0,1]');
  if (!Number.isFinite(config.mutationScale) || config.mutationScale < 0) throw new Error('Mutation scale must be non-negative');
  if (!Number.isFinite(config.diversityWeight) || config.diversityWeight < 0) throw new Error('Diversity weight must be non-negative');
}

export class DefaultAdaptiveScenarioOperator implements AdaptiveScenarioOperator {
  crossover(left: ScenarioGenome, right: ScenarioGenome, scenarioId: string, rng: RandomSource): ScenarioGenome {
    const keys = [...new Set([...Object.keys(left.genes), ...Object.keys(right.genes)])].sort();
    const genes: Record<string, number> = {};
    for (const key of keys) {
      const a = left.genes[key] ?? 0;
      const b = right.genes[key] ?? 0;
      genes[key] = rng.next() < 0.5 ? a : b;
    }
    return Object.freeze({ scenarioId, sport: left.sport, genes: Object.freeze(genes), parentScenarioIds: Object.freeze([left.scenarioId, right.scenarioId]), generation: Math.max(left.generation, right.generation) + 1 });
  }

  mutate(parent: ScenarioGenome, scenarioId: string, rng: RandomSource, scale: number): ScenarioGenome {
    const genes: Record<string, number> = { ...parent.genes };
    for (const key of Object.keys(genes)) {
      if (rng.next() <= 0.5) {
        const delta = (rng.next() * 2 - 1) * scale;
        genes[key] = clamp(genes[key] + delta, -1, 1);
      }
    }
    return Object.freeze({ scenarioId, sport: parent.sport, genes: Object.freeze(genes), parentScenarioIds: Object.freeze([parent.scenarioId]), generation: parent.generation + 1 });
  }
}

function distance(left: ScenarioGenome, right: ScenarioGenome): number {
  const keys = new Set([...Object.keys(left.genes), ...Object.keys(right.genes)]);
  if (keys.size === 0) return 0;
  let total = 0;
  for (const key of keys) total += Math.abs((left.genes[key] ?? 0) - (right.genes[key] ?? 0));
  return total / keys.size;
}

function diversityScore(candidate: ScenarioGenome, population: readonly ScenarioGenome[]): number {
  if (population.length === 0) return 1;
  const others = population.filter((item) => item.scenarioId !== candidate.scenarioId);
  if (others.length === 0) return 1;
  return others.reduce((sum, item) => sum + distance(candidate, item), 0) / others.length;
}

function evaluateFitness(evaluation: ScenarioEvaluation, diversity: number, weight: number): number {
  return evaluation.fitness + weight * diversity;
}

function selectParent(population: readonly ScenarioGenome[], evaluations: ReadonlyMap<string, ScenarioEvaluation>, rng: RandomSource, diversityWeight: number): ScenarioGenome {
  const a = population[Math.floor(rng.next() * population.length)];
  const b = population[Math.floor(rng.next() * population.length)];
  const score = (candidate: ScenarioGenome) => {
    const evaluation = evaluations.get(candidate.scenarioId);
    if (!evaluation) return Number.NEGATIVE_INFINITY;
    return evaluateFitness(evaluation, diversityScore(candidate, population), diversityWeight);
  };
  return score(a) >= score(b) ? a : b;
}

export class AdaptiveScenarioSearch {
  constructor(
    private readonly config: AdaptiveSearchConfig,
    private readonly operator: AdaptiveScenarioOperator = new DefaultAdaptiveScenarioOperator(),
  ) {
    validateConfig(config);
  }

  run(runId: string, initialPopulation: readonly ScenarioGenome[], evaluator: AdaptiveScenarioEvaluator): AdaptiveSearchResult {
    if (!runId.trim()) throw new Error('Adaptive search run ID is required');
    if (initialPopulation.length !== this.config.populationSize) throw new Error('Initial population size must match configuration');
    initialPopulation.forEach(validateGenome);
    const rng = new SeededRandom(this.config.seed);
    let population = Object.freeze([...initialPopulation]);
    const archive = new Map<string, ScenarioGenome>();
    let evaluations: ScenarioEvaluation[] = [];

    for (let generation = 0; generation < this.config.generations; generation += 1) {
      evaluations = population.map((scenario) => {
        const result = evaluator.evaluate(scenario);
        if (result.scenarioId !== scenario.scenarioId) throw new Error('Evaluator returned the wrong scenario ID');
        if (!Number.isFinite(result.fitness)) throw new Error('Adaptive scenario fitness must be finite');
        return Object.freeze({ ...result, evidenceIds: Object.freeze([...result.evidenceIds]), simulationIds: Object.freeze([...result.simulationIds]) });
      });
      const evaluationMap = new Map(evaluations.map((evaluation) => [evaluation.scenarioId, evaluation]));
      const ranked = [...population].sort((a, b) => {
        const scoreA = evaluateFitness(evaluationMap.get(a.scenarioId)!, diversityScore(a, population), this.config.diversityWeight);
        const scoreB = evaluateFitness(evaluationMap.get(b.scenarioId)!, diversityScore(b, population), this.config.diversityWeight);
        return scoreB - scoreA || a.scenarioId.localeCompare(b.scenarioId);
      });
      ranked.slice(0, this.config.eliteCount).forEach((scenario) => archive.set(scenario.scenarioId, scenario));
      if (generation === this.config.generations - 1) break;

      const next: ScenarioGenome[] = ranked.slice(0, this.config.eliteCount);
      while (next.length < this.config.populationSize) {
        const left = selectParent(population, evaluationMap, rng, this.config.diversityWeight);
        const right = selectParent(population, evaluationMap, rng, this.config.diversityWeight);
        const childId = `${runId}:g${generation + 1}:s${next.length + 1}`;
        let child = this.operator.crossover(left, right, childId, rng);
        if (rng.next() < this.config.mutationRate) child = this.operator.mutate(child, childId, rng, this.config.mutationScale);
        next.push(child);
      }
      population = Object.freeze(next);
    }

    const finalEvaluations = [...evaluations].sort((a, b) => b.fitness - a.fitness || a.scenarioId.localeCompare(b.scenarioId));
    return Object.freeze({ runId, generation: this.config.generations - 1, population, evaluations: Object.freeze(finalEvaluations), archive: Object.freeze([...archive.values()]), seed: this.config.seed });
  }
}

export function scenarioFingerprint(scenario: ScenarioGenome): string {
  validateGenome(scenario);
  return `${scenario.sport}:${stableGenes(scenario.genes)}`;
}
