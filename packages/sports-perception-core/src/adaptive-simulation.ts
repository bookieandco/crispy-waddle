import type { PredictionDistribution } from './contracts.js';
import {
  AdaptiveScenarioSearch,
  type AdaptiveScenarioEvaluator,
  type AdaptiveSearchConfig,
  type ScenarioEvaluation,
  type ScenarioGenome,
} from './adaptive-scenario-search.js';
import {
  MonteCarloSimulator,
  ScenarioEngine,
  type MonteCarloOptions,
  type SimulationModel,
  type SimulationRun,
  type SimulationState,
} from './simulation.js';

export interface AdaptiveSimulationObjective {
  outcomeUtility: Readonly<Record<string, number>>;
  worstCaseWeight?: number;
  expectedValueWeight?: number;
  uncertaintyWeight?: number;
}

export interface AdaptiveSimulationContext {
  runId: string;
  state: SimulationState;
  model: SimulationModel;
  prediction: PredictionDistribution;
  calibrationVersion: string;
  iterations: number;
  seed: number;
  objective: AdaptiveSimulationObjective;
  evidenceIds?: readonly string[];
  scenarioVersion?: string;
  datasetVersion?: string;
  featureSetVersion?: string;
}

export interface AdaptiveSimulationEvaluation extends ScenarioEvaluation {
  simulationId: string;
  simulation: SimulationRun;
}

export interface AdaptiveSimulationResult {
  searchRunId: string;
  context: AdaptiveSimulationContext;
  simulations: readonly SimulationRun[];
  evaluations: readonly AdaptiveSimulationEvaluation[];
  search: ReturnType<AdaptiveScenarioSearch['run']>;
}

function utility(distribution: SimulationRun['distribution'], objective: AdaptiveSimulationObjective): number {
  return distribution.outcomes.reduce((sum, outcome) => sum + outcome.probability * (objective.outcomeUtility[outcome.outcome] ?? 0), 0);
}

function worstCase(distribution: SimulationRun['distribution'], objective: AdaptiveSimulationObjective): number {
  if (distribution.outcomes.length === 0) return 0;
  return Math.min(...distribution.outcomes.map((outcome) => objective.outcomeUtility[outcome.outcome] ?? 0));
}

function entropy(distribution: SimulationRun['distribution']): number {
  return -distribution.outcomes.reduce((sum, outcome) => {
    if (outcome.probability <= 0) return sum;
    return sum + outcome.probability * Math.log(outcome.probability);
  }, 0);
}

function simulationFitness(run: SimulationRun, objective: AdaptiveSimulationObjective): { fitness: number; expectedValue: number; worstCase: number; uncertainty: number } {
  const expectedValue = utility(run.distribution, objective);
  const worst = worstCase(run.distribution, objective);
  const uncertainty = entropy(run.distribution);
  const expectedWeight = objective.expectedValueWeight ?? 1;
  const worstWeight = objective.worstCaseWeight ?? 0;
  const uncertaintyWeight = objective.uncertaintyWeight ?? 0;
  return {
    fitness: expectedWeight * expectedValue + worstWeight * worst - uncertaintyWeight * uncertainty,
    expectedValue,
    worstCase: worst,
    uncertainty,
  };
}

function genomeIntervention(scenario: ScenarioGenome) {
  return Object.freeze({
    interventionId: `${scenario.scenarioId}:genes`,
    type: 'ADAPTIVE_SCENARIO_GENOME',
    description: `Adaptive scenario generation ${scenario.generation}`,
    patch: Object.freeze({ adaptiveScenarioGenes: Object.freeze({ ...scenario.genes }) }),
    evidenceIds: Object.freeze([]),
  });
}

export function createAdaptiveSimulationEvaluator(
  context: AdaptiveSimulationContext,
  scenarioEngine: ScenarioEngine = new ScenarioEngine(),
  simulator: MonteCarloSimulator = new MonteCarloSimulator(),
): AdaptiveScenarioEvaluator & { evaluations: readonly AdaptiveSimulationEvaluation[] } {
  const baseline = scenarioEngine.createBaseline(context.state);
  const evaluations: AdaptiveSimulationEvaluation[] = [];
  const api = {
    evaluate(scenario: ScenarioGenome): AdaptiveSimulationEvaluation {
      if (scenario.sport !== context.state.sport) throw new Error('Adaptive scenario sport must match simulation state sport');
      const branch = scenario.generation === 0 && scenario.scenarioId === baseline.scenarioId
        ? baseline
        : scenarioEngine.branch(baseline, scenario.scenarioId, `ADAPTIVE_G${scenario.generation}`, [genomeIntervention(scenario)]);
      const simulationId = `${context.runId}:simulation:${scenario.scenarioId}`;
      const options: MonteCarloOptions = {
        simulationId,
        scenario: branch,
        model: context.model,
        prediction: context.prediction,
        calibrationVersion: context.calibrationVersion,
        seed: (context.seed + scenario.generation) >>> 0,
        iterations: context.iterations,
        scenarioVersion: context.scenarioVersion,
        datasetVersion: context.datasetVersion,
        featureSetVersion: context.featureSetVersion,
      };
      const simulation = simulator.run(options);
      const scored = simulationFitness(simulation, context.objective);
      const evidenceIds = Object.freeze([
        ...new Set([...(context.evidenceIds ?? []), ...(simulation.provenance.playerEvidenceIds ?? [])]),
      ].sort());
      const evaluation: AdaptiveSimulationEvaluation = Object.freeze({
        scenarioId: scenario.scenarioId,
        objectives: Object.freeze({
          EXPECTED_VALUE: scored.expectedValue,
          WORST_CASE: scored.worstCase,
          ROBUSTNESS: scored.worstCase - scored.expectedValue,
          DIVERSITY: 0,
          UNCERTAINTY: scored.uncertainty,
        }),
        fitness: scored.fitness,
        outcomeDistribution: Object.freeze(Object.fromEntries(simulation.distribution.outcomes.map((item) => [item.outcome, item.probability]))),
        evidenceIds,
        simulationIds: Object.freeze([simulation.simulationId]),
        simulationId,
        simulation,
      });
      evaluations.push(evaluation);
      return evaluation;
    },
  };
  Object.defineProperty(api, 'evaluations', { value: evaluations, enumerable: true });
  return api as AdaptiveScenarioEvaluator & { evaluations: readonly AdaptiveSimulationEvaluation[] };
}

export function runAdaptiveSimulationSearch(
  context: AdaptiveSimulationContext,
  searchConfig: AdaptiveSearchConfig,
  initialPopulation: readonly ScenarioGenome[],
): AdaptiveSimulationResult {
  const search = new AdaptiveScenarioSearch(searchConfig);
  const evaluator = createAdaptiveSimulationEvaluator(context);
  const result = search.run(context.runId, initialPopulation, evaluator);
  const simulations = Object.freeze(evaluator.evaluations.map((evaluation) => evaluation.simulation));
  return Object.freeze({
    searchRunId: context.runId,
    context,
    simulations,
    evaluations: evaluator.evaluations,
    search: result,
  });
}
