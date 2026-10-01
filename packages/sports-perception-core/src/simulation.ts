import type { ISODateTime, PredictionDistribution, Sport } from './contracts.js';

export type SimulationDisagreementLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SimulationState {
  stateId: string;
  eventId: string;
  sport: Sport;
  asOf: ISODateTime;
  worldState: Readonly<Record<string, unknown>>;
  realityStateHash: string;
  featureSnapshotId: string;
}

export interface Intervention {
  interventionId: string;
  type: string;
  description: string;
  patch: Readonly<Record<string, unknown>>;
  evidenceIds?: readonly string[];
}

export interface ScenarioBranch {
  scenarioId: string;
  parentScenarioId?: string;
  label: string;
  interventions: readonly Intervention[];
  state: SimulationState;
  scenarioHash: string;
}

export interface RandomSource {
  next(): number;
}

export interface SimulationDistribution {
  outcomes: ReadonlyArray<{
    outcome: string;
    probability: number;
    count: number;
  }>;
  iterations: number;
  seed: number;
  rngVersion: string;
}

export interface SimulationProvenance {
  datasetVersion?: string;
  featureSetVersion?: string;
  scenarioVersion: string;
  interventions: readonly Intervention[];
  rngVersion: string;
}

export interface SimulationRun {
  simulationId: string;
  scenarioId: string;
  eventId: string;
  sport: Sport;
  modelId: string;
  modelVersion: string;
  calibrationVersion: string;
  realityStateHash: string;
  featureSnapshotId: string;
  seed: number;
  iterations: number;
  distribution: SimulationDistribution;
  inputHash: string;
  provenance: SimulationProvenance;
}

export interface SimulationDisagreement {
  baselineScenarioId: string;
  comparedScenarioIds: readonly string[];
  outcome: string;
  maxAbsoluteProbabilityDelta: number;
  meanProbabilityDelta: number;
  level: SimulationDisagreementLevel;
}

export interface SimulationModel {
  readonly modelId: string;
  readonly modelVersion: string;
  simulate(state: SimulationState, rng: RandomSource): string;
}

export interface SimulationExplanation {
  featureId: string;
  direction: 'INCREASES' | 'DECREASES' | 'MIXED';
  effectMagnitude: number;
  scenarioId: string;
}

export interface SimulationExplainer {
  explain(baseline: SimulationRun, scenario: SimulationRun): readonly SimulationExplanation[];
}

export const SIMULATION_RNG_VERSION = 'mulberry32-v1';
export const DEFAULT_SCENARIO_VERSION = 'scenario-v1';

function assertNonEmpty(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} is required`);
}

function assertProbability(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be within [0,1]`);
  }
}

function assertValidDate(value: string, label: string): void {
  if (!Number.isFinite(new Date(value).getTime())) throw new Error(`${label} must be a valid ISO date`);
}

function stableValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableValue(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}

function stableHash(parts: readonly string[]): string {
  // Deterministic provenance key. This is intentionally not presented as a cryptographic hash.
  return parts.slice().sort().join('|');
}

function freezeIntervention(intervention: Intervention): Intervention {
  assertNonEmpty(intervention.interventionId, 'Intervention ID');
  assertNonEmpty(intervention.type, 'Intervention type');
  return Object.freeze({
    ...intervention,
    patch: Object.freeze({ ...intervention.patch }),
    evidenceIds: intervention.evidenceIds ? Object.freeze([...intervention.evidenceIds]) : undefined,
  });
}

export function validateSimulationDistribution(distribution: SimulationDistribution): void {
  if (!Number.isInteger(distribution.iterations) || distribution.iterations <= 0) {
    throw new Error('Simulation iterations must be a positive integer');
  }
  if (!Number.isInteger(distribution.seed) || distribution.seed < 0 || distribution.seed > 0xffffffff) {
    throw new Error('Simulation seed must be an unsigned 32-bit integer');
  }
  if (distribution.rngVersion !== SIMULATION_RNG_VERSION) {
    throw new Error(`Unsupported RNG version ${distribution.rngVersion}`);
  }

  const outcomes = new Set<string>();
  let probabilityTotal = 0;
  let countTotal = 0;
  for (const item of distribution.outcomes) {
    assertNonEmpty(item.outcome, 'Simulation outcome');
    if (outcomes.has(item.outcome)) throw new Error(`Duplicate simulation outcome ${item.outcome}`);
    outcomes.add(item.outcome);
    assertProbability(item.probability, `Probability for ${item.outcome}`);
    if (!Number.isInteger(item.count) || item.count < 0) throw new Error(`Count for ${item.outcome} must be a non-negative integer`);
    probabilityTotal += item.probability;
    countTotal += item.count;
  }

  if (distribution.outcomes.length === 0) throw new Error('Simulation must produce at least one outcome');
  if (Math.abs(probabilityTotal - 1) > 1e-9) throw new Error(`Simulation probabilities must sum to 1, got ${probabilityTotal}`);
  if (countTotal !== distribution.iterations) throw new Error('Simulation outcome counts must equal iterations');
}

export class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed: number) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be an unsigned 32-bit integer');
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export function sampleDistribution(distribution: PredictionDistribution, rng: RandomSource): string {
  if (distribution.outcomes.length === 0) throw new Error('Cannot sample an empty distribution');
  const total = distribution.outcomes.reduce((sum, item) => sum + item.probability, 0);
  if (Math.abs(total - 1) > 1e-9) throw new Error('Prediction distribution must sum to 1');

  const draw = rng.next();
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Random source must return values in [0,1)');

  let cumulative = 0;
  for (const item of distribution.outcomes) {
    cumulative += item.probability;
    if (draw < cumulative) return item.outcome;
  }
  return distribution.outcomes[distribution.outcomes.length - 1].outcome;
}

export class ScenarioEngine {
  createBaseline(state: SimulationState): ScenarioBranch {
    validateSimulationState(state);
    const scenarioId = `baseline:${state.stateId}`;
    return Object.freeze({
      scenarioId,
      label: 'BASELINE',
      interventions: Object.freeze([]),
      state: cloneState(state, scenarioId),
      scenarioHash: stableHash([scenarioId, state.realityStateHash, state.featureSnapshotId, stableValue(state.worldState)]),
    });
  }

  branch(parent: ScenarioBranch, scenarioId: string, label: string, interventions: readonly Intervention[]): ScenarioBranch {
    assertNonEmpty(scenarioId, 'Scenario ID');
    assertNonEmpty(label, 'Scenario label');
    if (interventions.length === 0) throw new Error('Scenario branch requires at least one intervention');

    const frozenInterventions = Object.freeze(interventions.map(freezeIntervention));
    const worldState = Object.freeze({
      ...parent.state.worldState,
      ...Object.assign({}, ...frozenInterventions.map((intervention) => intervention.patch)),
    });
    const state = Object.freeze({
      ...parent.state,
      stateId: scenarioId,
      worldState,
    });
    const scenarioHash = stableHash([
      parent.scenarioHash,
      scenarioId,
      label,
      ...frozenInterventions.map((intervention) => `${intervention.interventionId}:${stableValue(intervention.patch)}`),
    ]);

    return Object.freeze({
      scenarioId,
      parentScenarioId: parent.scenarioId,
      label,
      interventions: frozenInterventions,
      state,
      scenarioHash,
    });
  }
}

function cloneState(state: SimulationState, stateId: string): SimulationState {
  return Object.freeze({
    ...state,
    stateId,
    worldState: Object.freeze({ ...state.worldState }),
  });
}

export function validateSimulationState(state: SimulationState): void {
  assertNonEmpty(state.stateId, 'Simulation state ID');
  assertNonEmpty(state.eventId, 'Simulation event ID');
  assertNonEmpty(state.realityStateHash, 'Reality state hash');
  assertNonEmpty(state.featureSnapshotId, 'Feature snapshot ID');
  assertValidDate(state.asOf, 'Simulation state asOf');
}

export interface MonteCarloOptions {
  simulationId: string;
  scenario: ScenarioBranch;
  model: SimulationModel;
  prediction: PredictionDistribution;
  calibrationVersion: string;
  seed: number;
  iterations: number;
  scenarioVersion?: string;
  datasetVersion?: string;
  featureSetVersion?: string;
}

export class MonteCarloSimulator {
  run(options: MonteCarloOptions): SimulationRun {
    assertNonEmpty(options.simulationId, 'Simulation ID');
    assertNonEmpty(options.calibrationVersion, 'Calibration version');
    validateSimulationState(options.scenario.state);
    if (options.model.modelId !== options.prediction.modelId || options.model.modelVersion !== options.prediction.modelVersion) {
      throw new Error('Simulation model and prediction lineage do not match');
    }
    if (!Number.isInteger(options.iterations) || options.iterations <= 0) throw new Error('Simulation iterations must be a positive integer');

    const rng = new SeededRandom(options.seed);
    const counts = new Map<string, number>();
    for (let index = 0; index < options.iterations; index += 1) {
      const outcome = options.model.simulate(options.scenario.state, rng);
      assertNonEmpty(outcome, 'Simulation model outcome');
      counts.set(outcome, (counts.get(outcome) ?? 0) + 1);
    }

    const outcomes = [...counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([outcome, count]) => ({ outcome, count, probability: count / options.iterations }));
    const distribution: SimulationDistribution = Object.freeze({
      outcomes: Object.freeze(outcomes),
      iterations: options.iterations,
      seed: options.seed,
      rngVersion: SIMULATION_RNG_VERSION,
    });
    validateSimulationDistribution(distribution);

    const provenance: SimulationProvenance = Object.freeze({
      datasetVersion: options.datasetVersion,
      featureSetVersion: options.featureSetVersion,
      scenarioVersion: options.scenarioVersion ?? DEFAULT_SCENARIO_VERSION,
      interventions: options.scenario.interventions,
      rngVersion: SIMULATION_RNG_VERSION,
    });

    return Object.freeze({
      simulationId: options.simulationId,
      scenarioId: options.scenario.scenarioId,
      eventId: options.scenario.state.eventId,
      sport: options.scenario.state.sport,
      modelId: options.model.modelId,
      modelVersion: options.model.modelVersion,
      calibrationVersion: options.calibrationVersion,
      realityStateHash: options.scenario.state.realityStateHash,
      featureSnapshotId: options.scenario.state.featureSnapshotId,
      seed: options.seed,
      iterations: options.iterations,
      distribution,
      inputHash: stableHash([
        options.scenario.scenarioHash,
        options.model.modelId,
        options.model.modelVersion,
        options.prediction.modelId,
        options.prediction.modelVersion,
        options.calibrationVersion,
        String(options.seed),
        String(options.iterations),
      ]),
      provenance,
    });
  }
}

function probabilityMap(run: SimulationRun): Map<string, number> {
  return new Map(run.distribution.outcomes.map((item) => [item.outcome, item.probability]));
}

function disagreementLevel(delta: number): SimulationDisagreementLevel {
  if (delta >= 0.35) return 'CRITICAL';
  if (delta >= 0.20) return 'HIGH';
  if (delta >= 0.10) return 'MEDIUM';
  return 'LOW';
}

export function compareSimulationRuns(baseline: SimulationRun, scenarios: readonly SimulationRun[]): readonly SimulationDisagreement[] {
  if (scenarios.length === 0) return Object.freeze([]);
  if (baseline.eventId !== scenarios[0].eventId || baseline.realityStateHash !== scenarios[0].realityStateHash) {
    throw new Error('Simulation comparison requires shared event and reality-state lineage');
  }
  for (const scenario of scenarios) {
    if (scenario.eventId !== baseline.eventId) throw new Error('Simulation comparison requires the same event');
    if (scenario.realityStateHash !== baseline.realityStateHash) throw new Error('Simulation comparison requires the same reality state');
    if (scenario.modelId !== baseline.modelId || scenario.modelVersion !== baseline.modelVersion) {
      throw new Error('Simulation comparison requires the same model lineage');
    }
  }

  const baselineMap = probabilityMap(baseline);
  const outcomes = new Set<string>(baseline.distribution.outcomes.map((item) => item.outcome));
  scenarios.forEach((run) => run.distribution.outcomes.forEach((item) => outcomes.add(item.outcome)));

  return Object.freeze([...outcomes].sort().map((outcome) => {
    const baselineProbability = baselineMap.get(outcome) ?? 0;
    const deltas = scenarios.map((scenario) => (probabilityMap(scenario).get(outcome) ?? 0) - baselineProbability);
    const absoluteDeltas = deltas.map(Math.abs);
    const maxAbsoluteProbabilityDelta = Math.max(...absoluteDeltas);
    const meanProbabilityDelta = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
    return Object.freeze({
      baselineScenarioId: baseline.scenarioId,
      comparedScenarioIds: Object.freeze(scenarios.map((scenario) => scenario.scenarioId)),
      outcome,
      maxAbsoluteProbabilityDelta,
      meanProbabilityDelta,
      level: disagreementLevel(maxAbsoluteProbabilityDelta),
    });
  }));
}
