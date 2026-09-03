import type { RealityStateVersion } from './reality-state-event-resolver.js';

export type RealityDivergenceKind =
  | 'STATE'
  | 'EVENT'
  | 'SCORE'
  | 'POSSESSION'
  | 'PLAYER'
  | 'TIMING'
  | 'UNKNOWN';

export interface RealityExpectedState<TState = Readonly<Record<string, unknown>>> {
  state: TState;
  eventIds: readonly string[];
  stateHash: string;
}

export interface RealityDivergence {
  kind: RealityDivergenceKind;
  path: string;
  expected: unknown;
  actual: unknown;
  severity: number;
  evidenceIds: readonly string[];
}

export interface RealityDivergenceReport {
  expectedVersion?: number;
  actualVersion: number;
  expectedStateHash: string;
  actualStateHash: string;
  changed: boolean;
  divergences: readonly RealityDivergence[];
  eventIdsAdded: readonly string[];
  eventIdsMissing: readonly string[];
  summary: string;
}

const stable = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stable(object[key])}`).join(',')}}`;
};

const flatten = (value: unknown, prefix = ''): Map<string, unknown> => {
  const result = new Map<string, unknown>();
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      for (const [childPath, childValue] of flatten(child, path)) result.set(childPath, childValue);
    }
    if (Object.keys(value as object).length === 0) result.set(prefix, value);
  } else {
    result.set(prefix || '$', value);
  }
  return result;
};

const classify = (path: string): RealityDivergenceKind => {
  const lower = path.toLowerCase();
  if (lower.includes('score')) return 'SCORE';
  if (lower.includes('possession')) return 'POSSESSION';
  if (lower.includes('player')) return 'PLAYER';
  if (lower.includes('clock') || lower.includes('time') || lower.includes('period')) return 'TIMING';
  return 'STATE';
};

const severityFor = (expected: unknown, actual: unknown): number => {
  if (typeof expected === 'number' && typeof actual === 'number') {
    const scale = Math.max(1, Math.abs(expected), Math.abs(actual));
    return Math.min(1, Math.abs(expected - actual) / scale);
  }
  return stable(expected) === stable(actual) ? 0 : 1;
};

export function attributeRealityDivergence<TState>(
  expected: RealityExpectedState<TState>,
  actual: RealityStateVersion<TState>,
  evidenceIds: readonly string[] = [],
): RealityDivergenceReport {
  const expectedFields = flatten(expected.state);
  const actualFields = flatten(actual.state);
  const paths = [...new Set([...expectedFields.keys(), ...actualFields.keys()])].sort();
  const divergences: RealityDivergence[] = [];

  for (const path of paths) {
    const expectedValue = expectedFields.get(path);
    const actualValue = actualFields.get(path);
    if (stable(expectedValue) === stable(actualValue)) continue;
    divergences.push(Object.freeze({
      kind: classify(path),
      path,
      expected: expectedValue,
      actual: actualValue,
      severity: severityFor(expectedValue, actualValue),
      evidenceIds: Object.freeze([...evidenceIds]),
    }));
  }

  const expectedEvents = new Set(expected.eventIds);
  const actualEvents = new Set(actual.eventIds);
  const eventIdsAdded = actual.eventIds.filter((id) => !expectedEvents.has(id));
  const eventIdsMissing = expected.eventIds.filter((id) => !actualEvents.has(id));
  const changed = expected.stateHash !== actual.stateHash || eventIdsAdded.length > 0 || eventIdsMissing.length > 0;

  const summary = changed
    ? `${divergences.length} state divergence(s); ${eventIdsAdded.length} unexpected event(s); ${eventIdsMissing.length} missing event(s)`
    : 'Expected and actual reality states agree';

  return Object.freeze({
    expectedStateHash: expected.stateHash,
    actualStateHash: actual.stateHash,
    actualVersion: actual.version,
    changed,
    divergences: Object.freeze(divergences),
    eventIdsAdded: Object.freeze([...eventIdsAdded]),
    eventIdsMissing: Object.freeze([...eventIdsMissing]),
    summary,
  });
}
