import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AdaptiveExperimentMemory,
  AdaptiveScenarioSearch,
  type ScenarioEvaluation,
  type ScenarioGenome,
} from './adaptive-scenario-search.js';

const scenario = (scenarioId: string, gene: number, generation = 0): ScenarioGenome => Object.freeze({
  scenarioId,
  sport: 'NBA',
  genes: Object.freeze({ pace: gene }),
  parentScenarioIds: Object.freeze([]),
  generation,
});

const evaluation = (scenarioId: string, fitness: number): ScenarioEvaluation => Object.freeze({
  scenarioId,
  objectives: Object.freeze({ EXPECTED_VALUE: fitness, WORST_CASE: fitness, ROBUSTNESS: 0, DIVERSITY: 0, UNCERTAINTY: 0 }),
  fitness,
  evidenceIds: Object.freeze([`evidence:${scenarioId}`]),
  simulationIds: Object.freeze([`simulation:${scenarioId}`]),
});

describe('AdaptiveExperimentMemory', () => {
  it('deduplicates fingerprints while retaining operator statistics', () => {
    const memory = new AdaptiveExperimentMemory();
    const first = scenario('s1', 0.25);
    const observation = {
      fingerprint: 'NBA:pace:0.25',
      scenarioId: first.scenarioId,
      generation: 0,
      evaluation: evaluation(first.scenarioId, 0.5),
      operator: 'MUTATION' as const,
      parentScenarioIds: Object.freeze([]),
      evidenceIds: first ? Object.freeze(['e1']) : Object.freeze([]),
      simulationIds: Object.freeze(['sim1']),
    };
    memory.record(observation, 0.2, 0.1);
    memory.record({ ...observation, scenarioId: 's2' }, 0.1, 0.2);
    assert.equal(memory.size, 1);
    assert.equal(memory.operatorStats().find((item) => item.operator === 'MUTATION')?.uses, 2);
  });
});

describe('AdaptiveScenarioSearch experiment memory', () => {
  it('returns experiment observations and learned operator statistics', () => {
    const population = [scenario('seed-a', -0.5), scenario('seed-b', 0.5)];
    const search = new AdaptiveScenarioSearch({
      populationSize: 2,
      generations: 2,
      eliteCount: 1,
      mutationRate: 0.5,
      mutationScale: 0.1,
      diversityWeight: 0.1,
      seed: 7,
      archiveSize: 2,
    });
    const result = search.run('memory-test', population, { evaluate: (candidate) => evaluation(candidate.scenarioId, candidate.genes.pace ?? 0) });
    assert.ok(result.experimentMemory.length >= 2);
    assert.equal(result.operatorStats.length, 3);
    assert.ok(result.operatorStats.some((item) => item.uses > 0));
  });
});
