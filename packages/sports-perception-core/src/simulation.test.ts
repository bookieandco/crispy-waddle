import { describe, expect, it } from 'vitest';
import type { PredictionDistribution } from './contracts.js';
import {
  MonteCarloSimulator,
  ScenarioEngine,
  SeededRandom,
  compareSimulationRuns,
  sampleDistribution,
  validateSimulationDistribution,
} from './simulation.js';

const prediction: PredictionDistribution = {
  outcomes: [
    { outcome: 'AWAY', probability: 0.4 },
    { outcome: 'HOME', probability: 0.6 },
  ],
  modelId: 'model-a',
  modelVersion: '1.0.0',
};

const state = {
  stateId: 'state-1',
  eventId: 'event-1',
  sport: 'NFL' as const,
  asOf: '2026-09-03T12:00:00.000Z',
  worldState: { homeStrength: 1, awayStrength: 0.9 },
  realityStateHash: 'reality-hash',
  featureSnapshotId: 'features-1',
};

describe('simulation fabric', () => {
  it('replays a seeded random stream deterministically', () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it('samples a valid prediction distribution', () => {
    const rng = new SeededRandom(7);
    expect(['AWAY', 'HOME']).toContain(sampleDistribution(prediction, rng));
  });

  it('creates immutable baseline and counterfactual branches', () => {
    const engine = new ScenarioEngine();
    const baseline = engine.createBaseline(state);
    const scenario = engine.branch(baseline, 'injury-home-qb', 'HOME_QB_OUT', [{
      interventionId: 'i-1',
      type: 'PLAYER_STATUS',
      description: 'Home quarterback unavailable',
      patch: { homeStrength: 0.75 },
    }]);

    expect(baseline.state.worldState.homeStrength).toBe(1);
    expect(scenario.state.worldState.homeStrength).toBe(0.75);
    expect(scenario.parentScenarioId).toBe(baseline.scenarioId);
    expect(Object.isFrozen(scenario)).toBe(true);
  });

  it('produces a reproducible Monte Carlo distribution', () => {
    const engine = new ScenarioEngine();
    const scenario = engine.createBaseline(state);
    const model = {
      modelId: 'model-a',
      modelVersion: '1.0.0',
      simulate: (_state: typeof state, rng: SeededRandom) => rng.next() < 0.6 ? 'HOME' : 'AWAY',
    };
    const simulator = new MonteCarloSimulator();
    const options = {
      simulationId: 'sim-1',
      scenario,
      model,
      prediction,
      calibrationVersion: 'cal-1',
      seed: 123,
      iterations: 1000,
    };

    const first = simulator.run(options);
    const second = simulator.run({ ...options, simulationId: 'sim-2' });
    expect(first.distribution).toEqual(second.distribution);
    validateSimulationDistribution(first.distribution);
  });

  it('makes scenario deltas explicit instead of mutating baseline truth', () => {
    const engine = new ScenarioEngine();
    const baseline = engine.createBaseline(state);
    const scenario = engine.branch(baseline, 'weather', 'WEATHER_SHIFT', [{
      interventionId: 'weather-1',
      type: 'WEATHER',
      description: 'High wind',
      patch: { homeStrength: 0.85 },
    }]);
    const model = {
      modelId: 'model-a',
      modelVersion: '1.0.0',
      simulate: (input: typeof state, rng: SeededRandom) => rng.next() < (input.worldState.homeStrength as number) / 2 ? 'HOME' : 'AWAY',
    };
    const simulator = new MonteCarloSimulator();
    const baseRun = simulator.run({ simulationId: 'base', scenario: baseline, model, prediction, calibrationVersion: 'cal-1', seed: 5, iterations: 5000 });
    const scenarioRun = simulator.run({ simulationId: 'scenario', scenario, model, prediction, calibrationVersion: 'cal-1', seed: 5, iterations: 5000 });
    const disagreement = compareSimulationRuns(baseRun, [scenarioRun]);

    expect(disagreement.find((item) => item.outcome === 'HOME')?.meanProbabilityDelta).toBeLessThan(0);
    expect(baseline.state.worldState.homeStrength).toBe(1);
  });
});
