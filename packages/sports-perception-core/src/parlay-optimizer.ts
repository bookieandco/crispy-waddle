import type { DependencyEdge } from './joint-outcomes.js';
import { calculateJointProbability } from './joint-outcomes.js';
import type { CanonicalMarketLeg } from './market-canonicalization.js';
import { isMarketLegEligible } from './market-canonicalization.js';
import { buildParlayRobustnessReport, type ParlayScenario } from './parlay-scenario.js';

export interface ParlayOptimizerPolicy {
  minLegs: number;
  maxLegs: number;
  maxCandidates: number;
  requireDependenciesForSameEvent?: boolean;
  calibrationWeight?: number;
  disagreementPenalty?: number;
}

export interface ParlayCandidate {
  legIds: readonly string[];
  legs: readonly CanonicalMarketLeg[];
  jointProbability: number;
  marketImpliedProbability: number;
  edge: number;
  robustnessScore: number;
  score: number;
  dependencyEvidenceIds: readonly string[];
}

export interface ParlayOptimizationResult {
  candidates: readonly ParlayCandidate[];
  truncated: boolean;
}

function finiteProbability(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be within [0,1]`);
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  const walk = (start: number, chosen: T[]): void => {
    if (chosen.length === size) {
      out.push([...chosen]);
      return;
    }
    for (let i = start; i <= items.length - (size - chosen.length); i += 1) {
      chosen.push(items[i]);
      walk(i + 1, chosen);
      chosen.pop();
    }
  };
  walk(0, []);
  return out;
}

function incompatible(legs: readonly CanonicalMarketLeg[], requireDependencies: boolean): boolean {
  const seenMarket = new Set<string>();
  for (const leg of legs) {
    if (seenMarket.has(leg.marketId)) return true;
    seenMarket.add(leg.marketId);
  }
  if (!requireDependencies) return false;
  const events = new Set(legs.map((leg) => leg.eventId));
  return events.size < legs.length;
}

export function optimizeParlays(
  legs: readonly CanonicalMarketLeg[],
  dependencyEdges: readonly DependencyEdge[],
  scenarios: readonly ParlayScenario[],
  policy: ParlayOptimizerPolicy,
): ParlayOptimizationResult {
  if (!Number.isInteger(policy.minLegs) || policy.minLegs < 2) throw new Error('minLegs must be an integer >= 2');
  if (!Number.isInteger(policy.maxLegs) || policy.maxLegs < policy.minLegs) throw new Error('maxLegs must be >= minLegs');
  if (!Number.isInteger(policy.maxCandidates) || policy.maxCandidates < 1) throw new Error('maxCandidates must be positive');
  const calibrationWeight = policy.calibrationWeight ?? 1;
  const disagreementPenalty = policy.disagreementPenalty ?? 0;
  if (!Number.isFinite(calibrationWeight) || calibrationWeight < 0 || !Number.isFinite(disagreementPenalty) || disagreementPenalty < 0 || disagreementPenalty > 1) {
    throw new Error('Invalid optimizer weights');
  }
  const eligible = legs.filter(isMarketLegEligible);
  const all: ParlayCandidate[] = [];
  const maxLegs = Math.min(policy.maxLegs, eligible.length);
  for (let size = policy.minLegs; size <= maxLegs; size += 1) {
    for (const combo of combinations(eligible, size)) {
      if (incompatible(combo, policy.requireDependenciesForSameEvent ?? true)) continue;
      const comboIds = new Set(combo.map((leg) => leg.legId));
      const edges = dependencyEdges.filter((edge) => comboIds.has(edge.fromLegId) && comboIds.has(edge.toLegId));
      const outcomeLegs = combo.map((leg) => ({ legId: leg.legId, eventId: leg.eventId, marketId: leg.marketId, outcome: leg.selection, probability: leg.fairProbability ?? leg.impliedProbability }));
      const joint = calculateJointProbability(outcomeLegs, edges);
      finiteProbability(joint.jointProbability, 'jointProbability');
      const marketImpliedProbability = combo.reduce((product, leg) => product * leg.impliedProbability, 1);
      const edge = joint.jointProbability - marketImpliedProbability;
      const robustness = buildParlayRobustnessReport(outcomeLegs, scenarios);
      const score = edge * robustness.robustnessScore * calibrationWeight * (1 - disagreementPenalty);
      all.push(Object.freeze({
        legIds: Object.freeze(combo.map((leg) => leg.legId)),
        legs: Object.freeze([...combo]),
        jointProbability: joint.jointProbability,
        marketImpliedProbability,
        edge,
        robustnessScore: robustness.robustnessScore,
        score,
        dependencyEvidenceIds: Object.freeze([...joint.dependencyEvidenceIds]),
      }));
      if (all.length > policy.maxCandidates * 4) break;
    }
    if (all.length > policy.maxCandidates * 4) break;
  }
  all.sort((a, b) => b.score - a.score || b.edge - a.edge || a.legIds.join('|').localeCompare(b.legIds.join('|')));
  return Object.freeze({
    candidates: Object.freeze(all.slice(0, policy.maxCandidates)),
    truncated: all.length > policy.maxCandidates,
  });
}
