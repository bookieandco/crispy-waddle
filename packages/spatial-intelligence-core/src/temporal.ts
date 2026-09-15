export type SpatialTemporalRelation =
  | 'observation'
  | 'observed_track'
  | 'reconstructed'
  | 'predicted';

export type SpatialTemporalContinuity =
  | 'continuous'
  | 'intermittent'
  | 'broken'
  | 'unknown';

export type SpatialTemporalFreshness =
  | 'FRESH'
  | 'AGING'
  | 'STALE'
  | 'EXPIRED'
  | 'UNKNOWN';

export type SpatialTemporalInput = {
  observedAt: string | null;
  receivedAt: string;
  relation: SpatialTemporalRelation;
  sourceHistory: boolean;
  continuity?: SpatialTemporalContinuity;
  gapBeforeMs?: number | null;
  gapAfterMs?: number | null;
};

export type SpatialTemporal = {
  observedAt: string | null;
  receivedAt: string;
  relation: SpatialTemporalRelation;
  sourceHistory: boolean;
  continuity: SpatialTemporalContinuity;
  gapBeforeMs: number | null;
  gapAfterMs: number | null;
};

/** Freshness thresholds are policy, not a truth score and must be supplied by the caller. */
export type SpatialFreshnessPolicy = {
  freshWithinMs: number;
  agingWithinMs: number;
  staleWithinMs: number;
  expiredAfterMs: number;
};

export function assertSpatialTemporal(input: SpatialTemporalInput): void {
  if (!input.receivedAt || Number.isNaN(Date.parse(input.receivedAt))) {
    throw new Error('SPATIAL_TEMPORAL_RECEIVED_AT_INVALID');
  }
  if (input.observedAt !== null && Number.isNaN(Date.parse(input.observedAt))) {
    throw new Error('SPATIAL_TEMPORAL_OBSERVED_AT_INVALID');
  }
  if (input.relation === 'predicted' && input.observedAt !== null) {
    throw new Error('SPATIAL_TEMPORAL_PREDICTION_CANNOT_BE_OBSERVATION_TIME');
  }
  for (const [name, value] of [
    ['gapBeforeMs', input.gapBeforeMs],
    ['gapAfterMs', input.gapAfterMs],
  ] as const) {
    if (value !== undefined && value !== null && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`SPATIAL_TEMPORAL_${name.toUpperCase()}_INVALID`);
    }
  }
}

export function normalizeSpatialTemporal(input: SpatialTemporalInput): SpatialTemporal {
  assertSpatialTemporal(input);
  return {
    observedAt: input.observedAt,
    receivedAt: input.receivedAt,
    relation: input.relation,
    sourceHistory: input.sourceHistory,
    continuity: input.continuity ?? 'unknown',
    gapBeforeMs: input.gapBeforeMs ?? null,
    gapAfterMs: input.gapAfterMs ?? null,
  };
}

export function computeTemporalGap(earlierObservedAt: string | null, laterObservedAt: string | null): number | null {
  if (earlierObservedAt === null || laterObservedAt === null) return null;
  const earlier = Date.parse(earlierObservedAt);
  const later = Date.parse(laterObservedAt);
  if (Number.isNaN(earlier) || Number.isNaN(later)) throw new Error('SPATIAL_TEMPORAL_TIMESTAMP_INVALID');
  if (later < earlier) throw new Error('SPATIAL_TEMPORAL_SEQUENCE_OUT_OF_ORDER');
  return later - earlier;
}

export function classifySpatialFreshness(
  receivedAt: string,
  now: string,
  policy: SpatialFreshnessPolicy,
): SpatialTemporalFreshness {
  if (Number.isNaN(Date.parse(receivedAt)) || Number.isNaN(Date.parse(now))) {
    return 'UNKNOWN';
  }
  if (
    !Number.isFinite(policy.freshWithinMs) ||
    !Number.isFinite(policy.agingWithinMs) ||
    !Number.isFinite(policy.staleWithinMs) ||
    !Number.isFinite(policy.expiredAfterMs) ||
    policy.freshWithinMs < 0 ||
    policy.agingWithinMs < policy.freshWithinMs ||
    policy.staleWithinMs < policy.agingWithinMs ||
    policy.expiredAfterMs < policy.staleWithinMs
  ) {
    throw new Error('SPATIAL_TEMPORAL_FRESHNESS_POLICY_INVALID');
  }

  const ageMs = Date.parse(now) - Date.parse(receivedAt);
  if (ageMs < 0) return 'UNKNOWN';
  if (ageMs <= policy.freshWithinMs) return 'FRESH';
  if (ageMs <= policy.agingWithinMs) return 'AGING';
  if (ageMs <= policy.staleWithinMs) return 'STALE';
  if (ageMs > policy.expiredAfterMs) return 'EXPIRED';
  return 'STALE';
}

/**
 * Adjacent observations provide temporal continuity metadata; missing observations do not imply absence.
 */
export function deriveContinuity(
  gapBeforeMs: number | null,
  gapAfterMs: number | null,
  expectedCadenceMs: number | null,
): SpatialTemporalContinuity {
  if (gapBeforeMs === null && gapAfterMs === null) return 'unknown';
  if (expectedCadenceMs === null || expectedCadenceMs <= 0) return 'intermittent';
  const gaps = [gapBeforeMs, gapAfterMs].filter((gap): gap is number => gap !== null);
  if (gaps.length === 0) return 'unknown';
  if (gaps.some((gap) => gap > expectedCadenceMs * 3)) return 'broken';
  if (gaps.some((gap) => gap > expectedCadenceMs * 1.5)) return 'intermittent';
  return 'continuous';
}
