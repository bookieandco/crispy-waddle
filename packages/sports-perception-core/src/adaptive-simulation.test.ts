import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PredictionDistribution } from './contracts.js';
import { runAdaptiveSimulationSearch, type AdaptiveSimulationContext } from './adaptive-simulation.js';
import type { ScenarioGenome } from './adaptive-scenario-search.js';
import type { SimulationModel, SimulationState } from './simulation.js';

const state: SimulationState = {
  stateId: 'state-1',
  eventId: 'game-1',
  sport: 'NBA',
  asOf: '2026-09-03T12:00:00.000Z',
  worldState: {},
  realityStateHash: 'reality-1',
  featureSnapshotId: 'features-1',
};

const prediction: PredictionDistribution = {
  outcomes: [
    { outcome: 'A_WIN', probability: 0.5 },
    { outcome: 'B_WIN', probability: 0.5 },
  ],
  modelId: 'test-model',
  modelVersion: '1',
};

const model: SimulationModel = {
  modelId: 'test-model',
  modelVersion: '1',
  simulate(input, rng) {
    const genes = (input.worldState.adaptiveScenarioGenes ?? {}) as Record<string, number>;
    const edge = genes.attack ?? 0;
    return rng.next() < 0.5 + edge * 0.25 ? 'A_WIN' : 'B_WIN';
  },
};

const context: AdaptiveSimulationContext = {
  runId: 'adaptive-test',
  state,
  model,
  prediction,
  calibrationVersion: 'cal-1',
  iterations: 100,
  seed: 42,
  evidenceIds: ['evidence-1'],
  objective: { outcomeUtility: { A_WIN: 1, B_WIN: -1 } },
};

const population: ScenarioGenome[] = [
  { scenarioId: 's1', sport: 'NBA', genes: { attack: -0.8 }, parentScenarioIds: [], generation: 0 },
  { scenarioId: 's2', sport: 'NBA', genes: { attack: -0.2 }, parentScenarioIds: [], generation: 0 },
  { scenarioId: 's3', sport: 'NBA', genes: { attack: 0.2 }, parentScenarioIds: [], generation: 0 },
  { scenarioId: 's4', sport: 'NBA', genes: { attack: 0.8 }, parentScenarioIds: [], generation: 0 },
];

describe('adaptive simulation bridge', () => {
  it('connects genomes to ScenarioEngine and MonteCarloSimulator with lineage', () => {
    const result = runAdaptiveSimulationSearch(context, { populationSize: 4, generations: 2, eliteCount: 1, mutationRate: 0, mutationScale: 0.1, diversityWeight: 0.1, seed: 7 }, population);
    assert.equal(result.searchRunId, 'adaptive-test');
    assert.equal(result.simulations.length, 8);
    assert.equal(result.evaluations.length, 8);
    const evaluation = result.evaluations[0];
    assert.equal(evaluation.simulationId, evaluation.simulation.simulationId);
    assert.equal(evaluation.simulation.realityStateHash, 'reality-1');
    assert.equal(evaluation.simulation.featureSnapshotId, 'features-1');
    assert.deepEqual(evaluation.evidenceIds, ['evidence-1']);
    assert.equal(evaluation.simulation.provenance.interventions.length, 1);
    assert.equal(evaluation.simulation.provenance.interventions[0].type, 'ADAPTIVE_SCENARIO_GENOME');
  });

  it('is deterministic for the same seeded simulation search', () => {
    const config = { populationSize: 4, generations: 2, eliteCount: 1, mutationRate: 0.5, mutationScale: 0.2, diversityWeight: 0.1, seed: 11 };
    const first = runAdaptiveSimulationSearch(context, config, population);
    const second = runAdaptiveSimulationSearch(context, config, population);
    assert.deepEqual(first.search, second.search);
    assert.deepEqual(first.simulations.map((run) => run.distribution), second.simulations.map((run) => run.distribution));
  });
});
