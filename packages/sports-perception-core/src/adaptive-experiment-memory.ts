import type { ScenarioEvaluation, ScenarioGenome } from './adaptive-scenario-search.js';

export interface ExperimentContext {
  realityStateHash: string;
  modelVersion: string;
  calibrationVersion: string;
  datasetVersion?: string;
  featureSetVersion?: string;
}

export type ExperimentOperator = 'SEEDED' | 'CROSSOVER' | 'MUTATION' | 'ARCHIVE_REUSE';

export interface ExperimentObservation {
  key: string;
  scenarioFingerprint: string;
  scenarioId: string;
  generation: number;
  operator: ExperimentOperator;
  parentScenarioIds: readonly string[];
  evaluation: ScenarioEvaluation;
  simulationIds: readonly string[];
  evidenceIds: readonly string[];
  context: ExperimentContext;
  recordedAt: string;
}

export interface ExperimentMemoryStats {
  evaluations: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface ExperimentMemorySnapshot {
  observations: readonly ExperimentObservation[];
  stats: ExperimentMemoryStats;
}

function stableContext(context: ExperimentContext): string {
  return [context.realityStateHash, context.modelVersion, context.calibrationVersion, context.datasetVersion ?? '', context.featureSetVersion ?? ''].join('|');
}

export function experimentContextKey(scenarioFingerprint: string, context: ExperimentContext): string {
  if (!scenarioFingerprint.trim()) throw new Error('Scenario fingerprint is required');
  if (!context.realityStateHash.trim() || !context.modelVersion.trim() || !context.calibrationVersion.trim()) {
    throw new Error('Experiment context requires reality state, model, and calibration versions');
  }
  return `${scenarioFingerprint}|${stableContext(context)}`;
}

export function experimentScenarioFingerprint(scenario: ScenarioGenome): string {
  const genes = Object.keys(scenario.genes).sort().map((key) => `${key}:${scenario.genes[key]}`).join('|');
  return `${scenario.sport}:${genes}`;
}

export class AdaptiveExperimentMemory {
  private readonly byKey = new Map<string, ExperimentObservation>();
  private cacheHits = 0;
  private cacheMisses = 0;

  record(
    scenario: ScenarioGenome,
    evaluation: ScenarioEvaluation,
    context: ExperimentContext,
    operator: ExperimentOperator,
    recordedAt: string,
  ): ExperimentObservation {
    const scenarioFingerprint = experimentScenarioFingerprint(scenario);
    const key = experimentContextKey(scenarioFingerprint, context);
    const observation: ExperimentObservation = Object.freeze({
      key,
      scenarioFingerprint,
      scenarioId: scenario.scenarioId,
      generation: scenario.generation,
      operator,
      parentScenarioIds: Object.freeze([...scenario.parentScenarioIds]),
      evaluation: Object.freeze({ ...evaluation, evidenceIds: Object.freeze([...evaluation.evidenceIds]), simulationIds: Object.freeze([...evaluation.simulationIds]) }),
      simulationIds: Object.freeze([...evaluation.simulationIds]),
      evidenceIds: Object.freeze([...evaluation.evidenceIds]),
      context: Object.freeze({ ...context }),
      recordedAt,
    });
    this.byKey.set(key, observation);
    return observation;
  }

  lookup(scenario: ScenarioGenome, context: ExperimentContext): ExperimentObservation | undefined {
    const key = experimentContextKey(experimentScenarioFingerprint(scenario), context);
    const result = this.byKey.get(key);
    if (result) this.cacheHits += 1;
    else this.cacheMisses += 1;
    return result;
  }

  clear(): void {
    this.byKey.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  snapshot(): ExperimentMemorySnapshot {
    return Object.freeze({
      observations: Object.freeze([...this.byKey.values()]),
      stats: Object.freeze({ evaluations: this.byKey.size, cacheHits: this.cacheHits, cacheMisses: this.cacheMisses }),
    });
  }
}
