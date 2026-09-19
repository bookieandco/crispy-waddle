import type { OutcomeLeg, DependencyEdge, JointProbabilityResult } from './joint-outcomes.js';
import { calculateJointProbability } from './joint-outcomes.js';

export type ScenarioStatus = 'BASELINE' | 'STRESSED' | 'SHOCKED';

export interface ParlayScenario {
  scenarioId: string;
  label: string;
  status: ScenarioStatus;
  probabilityMultiplier?: number;
  legProbabilityOverrides?: Readonly<Record<string, number>>;
  dependencyEdges?: readonly DependencyEdge[];
}

export interface ParlayScenarioResult {
  scenarioId: string;
  label: string;
  status: ScenarioStatus;
  joint: JointProbabilityResult;
  deltaFromBaseline: number;
  relativeDelta: number;
  probabilityFloor: number;
  probabilityCeiling: number;
}

export interface ParlayRobustnessReport {
  baseline: ParlayScenarioResult;
  scenarios: readonly ParlayScenarioResult[];
  minimumJointProbability: number;
  maximumJointProbability: number;
  worstCaseDelta: number;
  bestCaseDelta: number;
  robustnessScore: number;
}

function probability(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be within [0,1]`);
}

function applyScenario(legs: readonly OutcomeLeg[], scenario: ParlayScenario): OutcomeLeg[] {
  const multiplier = scenario.probabilityMultiplier ?? 1;
  if (!Number.isFinite(multiplier) || multiplier < 0) throw new Error('Scenario probability multiplier must be finite and non-negative');
  return legs.map((leg) => {
    const override = scenario.legProbabilityOverrides?.[leg.legId];
    const next = override === undefined ? leg.probability * multiplier : override;
    probability(next, `Scenario probability for ${leg.legId}`);
    return { ...leg, probability: next };
  });
}

export function evaluateParlayScenario(
  legs: readonly OutcomeLeg[],
  scenario: ParlayScenario,
  baselineJoint?: number,
  baselineDependencyEdges: readonly DependencyEdge[] = [],
): ParlayScenarioResult {
  if (!scenario.scenarioId || !scenario.label) throw new Error('Scenario requires stable identifiers');
  const adjustedLegs = applyScenario(legs, scenario);
  const joint = calculateJointProbability(adjustedLegs, scenario.dependencyEdges ?? baselineDependencyEdges);
  const baseline = baselineJoint ?? calculateJointProbability(legs, baselineDependencyEdges).jointProbability;
  const delta = joint.jointProbability - baseline;
  return Object.freeze({
    scenarioId: scenario.scenarioId,
    label: scenario.label,
    status: scenario.status,
    joint,
    deltaFromBaseline: delta,
    relativeDelta: baseline === 0 ? 0 : delta / baseline,
    probabilityFloor: Math.min(...adjustedLegs.map((leg) => leg.probability)),
    probabilityCeiling: Math.max(...adjustedLegs.map((leg) => leg.probability)),
  });
}

export function buildParlayRobustnessReport(
  legs: readonly OutcomeLeg[],
  scenarios: readonly ParlayScenario[],
  baselineDependencyEdges: readonly DependencyEdge[] = [],
): ParlayRobustnessReport {
  if (legs.length < 2) throw new Error('A parlay requires at least two legs');
  const baselineJoint = calculateJointProbability(legs, baselineDependencyEdges).jointProbability;
  const baseline = evaluateParlayScenario(legs, {
    scenarioId: 'baseline',
    label: 'Baseline',
    status: 'BASELINE',
    dependencyEdges: baselineDependencyEdges,
  }, baselineJoint, baselineDependencyEdges);
  const results = scenarios
    .filter((scenario) => scenario.status !== 'BASELINE')
    .map((scenario) => evaluateParlayScenario(legs, scenario, baselineJoint, baselineDependencyEdges));
  const all = [baseline, ...results];
  const values = all.map((result) => result.joint.jointProbability);
  const minimumJointProbability = Math.min(...values);
  const maximumJointProbability = Math.max(...values);
  const worstCaseDelta = Math.min(...all.map((result) => result.deltaFromBaseline));
  const bestCaseDelta = Math.max(...all.map((result) => result.deltaFromBaseline));
  const spread = maximumJointProbability - minimumJointProbability;
  const robustnessScore = baselineJoint === 0 ? 0 : Math.max(0, Math.min(1, 1 - spread / baselineJoint));
  return Object.freeze({
    baseline,
    scenarios: Object.freeze(results),
    minimumJointProbability,
    maximumJointProbability,
    worstCaseDelta,
    bestCaseDelta,
    robustnessScore,
  });
}

export function rankParlayScenarios(report: ParlayRobustnessReport): readonly ParlayScenarioResult[] {
  return Object.freeze([...report.scenarios].sort((a, b) => {
    if (b.joint.jointProbability !== a.joint.jointProbability) return b.joint.jointProbability - a.joint.jointProbability;
    return a.scenarioId.localeCompare(b.scenarioId);
  }));
}
