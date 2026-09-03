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

export interface ScenarioArchiveEntry {
  scenario: ScenarioGenome;
  evaluation: ScenarioEvaluation;
  paretoRank: number;
  crowdingDistance: number;
  novelty: number;
}

export interface AdaptiveSearchConfig {
  populationSize: number;
  generations: number;
  eliteCount: number;
  mutationRate: number;
  mutationScale: number;
  diversityWeight: number;
  seed: number;
  archiveSize?: number;
}

export interface AdaptiveSearchResult {
  runId: string;
  generation: number;
  population: readonly ScenarioGenome[];
  evaluations: readonly ScenarioEvaluation[];
  archive: readonly ScenarioGenome[];
  paretoArchive: readonly ScenarioArchiveEntry[];
  seed: number;
}

export interface AdaptiveScenarioEvaluator { evaluate(scenario: ScenarioGenome): ScenarioEvaluation; }
export interface AdaptiveScenarioOperator {
  crossover(left: ScenarioGenome, right: ScenarioGenome, scenarioId: string, rng: RandomSource): ScenarioGenome;
  mutate(parent: ScenarioGenome, scenarioId: string, rng: RandomSource, scale: number): ScenarioGenome;
}
export interface RandomSource { next(): number; }

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

function stableGenes(genes: Readonly<Record<string, number>>): string { return Object.keys(genes).sort().map((key) => `${key}:${genes[key]}`).join('|'); }
function validateGenome(scenario: ScenarioGenome): void {
  if (!scenario.scenarioId.trim() || !scenario.sport) throw new Error('Adaptive scenario identity is required');
  if (!Number.isInteger(scenario.generation) || scenario.generation < 0) throw new Error('Adaptive scenario generation must be non-negative');
  for (const [key, value] of Object.entries(scenario.genes)) if (!key.trim() || !Number.isFinite(value)) throw new Error('Adaptive scenario genes must contain finite numeric values');
}
function validateConfig(config: AdaptiveSearchConfig): void {
  if (!Number.isInteger(config.populationSize) || config.populationSize < 2) throw new Error('Population size must be at least 2');
  if (!Number.isInteger(config.generations) || config.generations < 1) throw new Error('Generations must be positive');
  if (!Number.isInteger(config.eliteCount) || config.eliteCount < 1 || config.eliteCount > config.populationSize) throw new Error('Elite count must be within the population');
  if (!Number.isFinite(config.mutationRate) || config.mutationRate < 0 || config.mutationRate > 1) throw new Error('Mutation rate must be within [0,1]');
  if (!Number.isFinite(config.mutationScale) || config.mutationScale < 0) throw new Error('Mutation scale must be non-negative');
  if (!Number.isFinite(config.diversityWeight) || config.diversityWeight < 0) throw new Error('Diversity weight must be non-negative');
  if (config.archiveSize !== undefined && (!Number.isInteger(config.archiveSize) || config.archiveSize < 1)) throw new Error('Archive size must be positive');
}

export class DefaultAdaptiveScenarioOperator implements AdaptiveScenarioOperator {
  crossover(left: ScenarioGenome, right: ScenarioGenome, scenarioId: string, rng: RandomSource): ScenarioGenome {
    if (left.sport !== right.sport) throw new Error('Cannot crossover scenarios from different sports');
    const keys = [...new Set([...Object.keys(left.genes), ...Object.keys(right.genes)])].sort();
    const genes: Record<string, number> = {};
    for (const key of keys) genes[key] = rng.next() < 0.5 ? (left.genes[key] ?? 0) : (right.genes[key] ?? 0);
    return Object.freeze({ scenarioId, sport: left.sport, genes: Object.freeze(genes), parentScenarioIds: Object.freeze([left.scenarioId, right.scenarioId]), generation: Math.max(left.generation, right.generation) + 1 });
  }
  mutate(parent: ScenarioGenome, scenarioId: string, rng: RandomSource, scale: number): ScenarioGenome {
    const genes: Record<string, number> = { ...parent.genes };
    for (const key of Object.keys(genes)) if (rng.next() <= 0.5) genes[key] = clamp(genes[key] + (rng.next() * 2 - 1) * scale, -1, 1);
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
  const others = population.filter((item) => item.scenarioId !== candidate.scenarioId);
  return others.length === 0 ? 1 : others.reduce((sum, item) => sum + distance(candidate, item), 0) / others.length;
}
function evaluateFitness(evaluation: ScenarioEvaluation, diversity: number, weight: number): number { return evaluation.fitness + weight * diversity; }

const objectiveDirections: Record<AdaptiveObjectiveKind, 1 | -1> = {
  EXPECTED_VALUE: 1, WORST_CASE: 1, ROBUSTNESS: 1, DIVERSITY: 1, UNCERTAINTY: -1,
};
function dominates(left: ScenarioEvaluation, right: ScenarioEvaluation): boolean {
  let strictlyBetter = false;
  for (const kind of Object.keys(objectiveDirections) as AdaptiveObjectiveKind[]) {
    const a = left.objectives[kind] ?? 0;
    const b = right.objectives[kind] ?? 0;
    const direction = objectiveDirections[kind];
    if (direction * a < direction * b) return false;
    if (direction * a > direction * b) strictlyBetter = true;
  }
  return strictlyBetter;
}
function paretoRank(evaluations: readonly ScenarioEvaluation[]): Map<string, number> {
  const ranks = new Map<string, number>();
  const remaining = new Set(evaluations.map((item) => item.scenarioId));
  let rank = 1;
  while (remaining.size) {
    const front = evaluations.filter((item) => remaining.has(item.scenarioId) && !evaluations.some((other) => remaining.has(other.scenarioId) && other.scenarioId !== item.scenarioId && dominates(other, item)));
    for (const item of front) { ranks.set(item.scenarioId, rank); remaining.delete(item.scenarioId); }
    rank += 1;
  }
  return ranks;
}
function crowdingDistance(front: readonly ScenarioEvaluation[]): Map<string, number> {
  const result = new Map(front.map((item) => [item.scenarioId, 0]));
  if (front.length <= 2) { front.forEach((item) => result.set(item.scenarioId, Number.POSITIVE_INFINITY)); return result; }
  for (const kind of Object.keys(objectiveDirections) as AdaptiveObjectiveKind[]) {
    const sorted = [...front].sort((a, b) => (a.objectives[kind] ?? 0) - (b.objectives[kind] ?? 0));
    const min = sorted[0].objectives[kind] ?? 0;
    const max = sorted[sorted.length - 1].objectives[kind] ?? 0;
    result.set(sorted[0].scenarioId, Number.POSITIVE_INFINITY);
    result.set(sorted[sorted.length - 1].scenarioId, Number.POSITIVE_INFINITY);
    if (max === min) continue;
    for (let index = 1; index < sorted.length - 1; index += 1) {
      const previous = sorted[index - 1].objectives[kind] ?? 0;
      const next = sorted[index + 1].objectives[kind] ?? 0;
      if (Number.isFinite(result.get(sorted[index].scenarioId))) result.set(sorted[index].scenarioId, (result.get(sorted[index].scenarioId) ?? 0) + Math.abs(next - previous) / Math.abs(max - min));
    }
  }
  return result;
}
function buildParetoArchive(population: readonly ScenarioGenome[], evaluations: readonly ScenarioEvaluation[], archiveSize: number): ScenarioArchiveEntry[] {
  const rankMap = paretoRank(evaluations);
  const first = evaluations.filter((item) => rankMap.get(item.scenarioId) === 1);
  const crowd = crowdingDistance(first);
  const byId = new Map(population.map((scenario) => [scenario.scenarioId, scenario]));
  return first.map((evaluation) => ({ scenario: byId.get(evaluation.scenarioId)!, evaluation, paretoRank: 1, crowdingDistance: crowd.get(evaluation.scenarioId) ?? 0, novelty: diversityScore(byId.get(evaluation.scenarioId)!, population) }))
    .sort((a, b) => b.crowdingDistance - a.crowdingDistance || b.novelty - a.novelty || b.evaluation.fitness - a.evaluation.fitness || a.scenario.scenarioId.localeCompare(b.scenario.scenarioId))
    .slice(0, archiveSize);
}
function selectParent(population: readonly ScenarioGenome[], evaluations: ReadonlyMap<string, ScenarioEvaluation>, rng: RandomSource, diversityWeight: number): ScenarioGenome {
  const a = population[Math.floor(rng.next() * population.length)];
  const b = population[Math.floor(rng.next() * population.length)];
  const score = (candidate: ScenarioGenome) => { const evaluation = evaluations.get(candidate.scenarioId); return evaluation ? evaluateFitness(evaluation, diversityScore(candidate, population), diversityWeight) : Number.NEGATIVE_INFINITY; };
  return score(a) >= score(b) ? a : b;
}

export class AdaptiveScenarioSearch {
  constructor(private readonly config: AdaptiveSearchConfig, private readonly operator: AdaptiveScenarioOperator = new DefaultAdaptiveScenarioOperator()) { validateConfig(config); }
  run(runId: string, initialPopulation: readonly ScenarioGenome[], evaluator: AdaptiveScenarioEvaluator): AdaptiveSearchResult {
    if (!runId.trim()) throw new Error('Adaptive search run ID is required');
    if (initialPopulation.length !== this.config.populationSize) throw new Error('Initial population size must match configuration');
    initialPopulation.forEach(validateGenome);
    const rng = new SeededRandom(this.config.seed);
    let population = Object.freeze([...initialPopulation]);
    const archive = new Map<string, ScenarioGenome>();
    let evaluations: ScenarioEvaluation[] = [];
    let paretoArchive: ScenarioArchiveEntry[] = [];
    for (let generation = 0; generation < this.config.generations; generation += 1) {
      evaluations = population.map((scenario) => {
        const result = evaluator.evaluate(scenario);
        if (result.scenarioId !== scenario.scenarioId || !Number.isFinite(result.fitness)) throw new Error('Evaluator returned an invalid scenario evaluation');
        return Object.freeze({ ...result, evidenceIds: Object.freeze([...result.evidenceIds]), simulationIds: Object.freeze([...result.simulationIds]) });
      });
      const evaluationMap = new Map(evaluations.map((evaluation) => [evaluation.scenarioId, evaluation]));
      const ranked = [...population].sort((a, b) => {
        const scoreA = evaluateFitness(evaluationMap.get(a.scenarioId)!, diversityScore(a, population), this.config.diversityWeight);
        const scoreB = evaluateFitness(evaluationMap.get(b.scenarioId)!, diversityScore(b, population), this.config.diversityWeight);
        return scoreB - scoreA || a.scenarioId.localeCompare(b.scenarioId);
      });
      ranked.slice(0, this.config.eliteCount).forEach((scenario) => archive.set(scenario.scenarioId, scenario));
      paretoArchive = buildParetoArchive(population, evaluations, this.config.archiveSize ?? this.config.populationSize);
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
    return Object.freeze({ runId, generation: this.config.generations - 1, population, evaluations: Object.freeze(finalEvaluations), archive: Object.freeze([...archive.values()]), paretoArchive: Object.freeze(paretoArchive.map((entry) => Object.freeze({ ...entry }))), seed: this.config.seed });
  }
}

export function scenarioFingerprint(scenario: ScenarioGenome): string { validateGenome(scenario); return `${scenario.sport}:${stableGenes(scenario.genes)}`; }
