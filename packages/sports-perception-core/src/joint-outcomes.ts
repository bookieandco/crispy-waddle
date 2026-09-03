export type JointDependenceKind = 'INDEPENDENT' | 'POSITIVE' | 'NEGATIVE' | 'CONDITIONAL' | 'LOGICAL_CONTAINMENT' | 'MUTUALLY_EXCLUSIVE';
export type JointConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface OutcomeLeg {
  legId: string;
  eventId: string;
  marketId: string;
  outcome: string;
  probability: number;
}

export interface DependencyEdge {
  fromLegId: string;
  toLegId: string;
  kind: JointDependenceKind;
  correlation?: number;
  conditionalProbability?: number;
  evidenceIds: readonly string[];
  confidence: JointConfidence;
}

export interface JointProbabilityResult {
  legIds: readonly string[];
  marginalProbability: number;
  jointProbability: number;
  dependenceAdjustment: number;
  independenceBaseline: number;
  dependenceKind: JointDependenceKind;
  confidence: JointConfidence;
  dependencyEvidenceIds: readonly string[];
}

function probability(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be within [0,1]`);
}

function correlation(value: number): void {
  if (!Number.isFinite(value) || value < -1 || value > 1) throw new Error('Correlation must be within [-1,1]');
}

function confidenceRank(value: JointConfidence): number {
  return value === 'HIGH' ? 3 : value === 'MEDIUM' ? 2 : 1;
}

function minConfidence(edges: readonly DependencyEdge[]): JointConfidence {
  if (edges.length === 0) return 'LOW';
  return edges.reduce((min, edge) => confidenceRank(edge.confidence) < confidenceRank(min) ? edge.confidence : min, 'HIGH' as JointConfidence);
}

export function independentJointProbability(legs: readonly OutcomeLeg[]): number {
  if (legs.length === 0) throw new Error('At least one outcome leg is required');
  legs.forEach((leg) => probability(leg.probability, `Probability for ${leg.legId}`));
  return legs.reduce((product, leg) => product * leg.probability, 1);
}

function edgeFor(a: OutcomeLeg, b: OutcomeLeg, edges: readonly DependencyEdge[]): DependencyEdge | undefined {
  return edges.find((edge) =>
    (edge.fromLegId === a.legId && edge.toLegId === b.legId) ||
    (edge.fromLegId === b.legId && edge.toLegId === a.legId));
}

export function calculateJointProbability(legs: readonly OutcomeLeg[], edges: readonly DependencyEdge[] = []): JointProbabilityResult {
  if (legs.length < 1) throw new Error('At least one outcome leg is required');
  const ids = new Set<string>();
  for (const leg of legs) {
    if (!leg.legId || !leg.eventId || !leg.marketId || !leg.outcome) throw new Error('Outcome legs require stable identifiers');
    if (ids.has(leg.legId)) throw new Error(`Duplicate leg ${leg.legId}`);
    ids.add(leg.legId);
    probability(leg.probability, `Probability for ${leg.legId}`);
  }
  for (const edge of edges) {
    if (!ids.has(edge.fromLegId) || !ids.has(edge.toLegId) || edge.fromLegId === edge.toLegId) throw new Error('Dependency edge references an invalid leg');
    if (edge.correlation !== undefined) correlation(edge.correlation);
    if (edge.conditionalProbability !== undefined) probability(edge.conditionalProbability, 'Conditional probability');
  }

  const baseline = independentJointProbability(legs);
  if (legs.length === 1) return Object.freeze({ legIds: Object.freeze([legs[0].legId]), marginalProbability: legs[0].probability, jointProbability: legs[0].probability, dependenceAdjustment: 0, independenceBaseline: baseline, dependenceKind: 'INDEPENDENT', confidence: 'HIGH', dependencyEvidenceIds: Object.freeze([]) });

  // Exact two-leg conditional calculation when supplied. This is preferred over
  // converting a correlation coefficient into a joint probability because it
  // preserves the explicitly observed conditional relationship.
  if (legs.length === 2) {
    const edge = edgeFor(legs[0], legs[1], edges);
    if (edge?.kind === 'MUTUALLY_EXCLUSIVE') return result(legs, baseline, 0, edge.kind, edge.confidence, edge.evidenceIds);
    if (edge?.kind === 'LOGICAL_CONTAINMENT') {
      const joint = Math.min(legs[0].probability, legs[1].probability);
      return result(legs, baseline, joint, edge.kind, edge.confidence, edge.evidenceIds);
    }
    if (edge?.conditionalProbability !== undefined) {
      const joint = legs[0].probability * edge.conditionalProbability;
      if (joint > Math.min(legs[0].probability, legs[1].probability) + 1e-12) throw new Error('Conditional joint probability exceeds a marginal probability');
      return result(legs, baseline, joint, 'CONDITIONAL', edge.confidence, edge.evidenceIds);
    }
    if (edge?.kind === 'INDEPENDENT' || !edge) return result(legs, baseline, baseline, 'INDEPENDENT', edge?.confidence ?? 'MEDIUM', edge?.evidenceIds ?? []);
    if (edge.correlation !== undefined) {
      const a = legs[0].probability;
      const b = legs[1].probability;
      const covariance = edge.correlation * Math.sqrt(a * (1 - a) * b * (1 - b));
      const joint = Math.max(0, Math.min(Math.min(a, b), baseline + covariance));
      return result(legs, baseline, joint, edge.kind, edge.confidence, edge.evidenceIds);
    }
  }

  // For n>2, only compose explicit conditional edges. Unspecified relationships
  // remain independent rather than inventing higher-order correlation.
  let joint = baseline;
  const evidence = new Set<string>();
  let kind: JointDependenceKind = 'INDEPENDENT';
  for (const edge of edges) {
    if (edge.evidenceIds) edge.evidenceIds.forEach((id) => evidence.add(id));
    if (edge.kind !== 'INDEPENDENT') kind = 'CONDITIONAL';
  }
  for (let i = 0; i < legs.length; i += 1) {
    for (let j = i + 1; j < legs.length; j += 1) {
      const edge = edgeFor(legs[i], legs[j], edges);
      if (edge?.kind === 'MUTUALLY_EXCLUSIVE') joint = 0;
      else if (edge?.conditionalProbability !== undefined) joint *= edge.conditionalProbability / legs[j].probability;
    }
  }
  joint = Math.max(0, Math.min(legs.map((leg) => leg.probability).reduce(Math.min), joint));
  return result(legs, baseline, joint, kind, minConfidence(edges), [...evidence].sort());
}

function result(legs: readonly OutcomeLeg[], baseline: number, joint: number, kind: JointDependenceKind, confidence: JointConfidence, evidenceIds: readonly string[]): JointProbabilityResult {
  probability(joint, 'Joint probability');
  return Object.freeze({
    legIds: Object.freeze(legs.map((leg) => leg.legId)),
    marginalProbability: Math.min(...legs.map((leg) => leg.probability)),
    jointProbability: joint,
    dependenceAdjustment: joint - baseline,
    independenceBaseline: baseline,
    dependenceKind: kind,
    confidence,
    dependencyEvidenceIds: Object.freeze([...new Set(evidenceIds)].sort()),
  });
}

export function validateDependencyGraph(legs: readonly OutcomeLeg[], edges: readonly DependencyEdge[]): void {
  const ids = new Set(legs.map((leg) => leg.legId));
  for (const edge of edges) {
    if (!ids.has(edge.fromLegId) || !ids.has(edge.toLegId)) throw new Error(`Unknown leg in dependency edge: ${edge.fromLegId}->${edge.toLegId}`);
    if (edge.correlation !== undefined) correlation(edge.correlation);
    if (edge.conditionalProbability !== undefined) probability(edge.conditionalProbability, 'Conditional probability');
  }
}
