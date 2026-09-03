import type { SportsEvent } from './sports-event.js';

export type RealityEventDisposition = 'APPLIED' | 'LATE' | 'DUPLICATE' | 'CONFLICT' | 'QUARANTINED';

export interface RealityStateEventRecord {
  event: SportsEvent;
  eventTimeMs: number;
  receivedTimeMs: number;
}

export interface RealityStateVersion<TState = Readonly<Record<string, unknown>>> {
  version: number;
  asOf: string;
  state: TState;
  eventIds: readonly string[];
  stateHash: string;
  provisional: boolean;
}

export interface RealityStateResolution<TState = Readonly<Record<string, unknown>>> {
  disposition: RealityEventDisposition;
  state: RealityStateVersion<TState>;
  inserted: boolean;
  requiresReplay: boolean;
  reason?: string;
}

export interface RealityStateReducer<TState> {
  initialState(): TState;
  reduce(state: TState, event: SportsEvent): TState;
}

const stableValue = (value: unknown): string => {
  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableValue(object[key])}`).join(',')}}`;
};

const hash = (value: unknown): string => {
  let h = 2166136261;
  for (const char of stableValue(value)) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
};

export class RealityStateEventResolver<TState> {
  private readonly records = new Map<string, RealityStateEventRecord>();
  private versions: RealityStateVersion<TState>[] = [];
  private watermarkMs = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly reducer: RealityStateReducer<TState>,
    private readonly allowedLatenessMs = 30_000,
  ) {
    if (!Number.isFinite(allowedLatenessMs) || allowedLatenessMs < 0) throw new Error('allowedLatenessMs must be non-negative');
  }

  ingest(event: SportsEvent): RealityStateResolution<TState> {
    const eventTimeMs = new Date(event.provenance.source.observedAt).getTime();
    const receivedTimeMs = new Date(event.provenance.source.receivedAt).getTime();
    if (!Number.isFinite(eventTimeMs) || !Number.isFinite(receivedTimeMs)) throw new Error('Reality event timestamps must be valid');

    const existing = this.records.get(event.eventId);
    if (existing) {
      const state = this.currentVersion();
      return { disposition: 'DUPLICATE', state, inserted: false, requiresReplay: false, reason: 'eventId already ingested' };
    }

    const late = eventTimeMs < this.watermarkMs;
    this.records.set(event.eventId, { event, eventTimeMs, receivedTimeMs });
    const replay = late || this.versions.length > 0;
    const state = this.rebuild();
    this.watermarkMs = Math.max(this.watermarkMs, eventTimeMs - this.allowedLatenessMs);

    return {
      disposition: late ? 'LATE' : 'APPLIED',
      state,
      inserted: true,
      requiresReplay: replay,
      ...(late ? { reason: 'event arrived behind the current event-time watermark' } : {}),
    };
  }

  advanceWatermark(observedAt: string): RealityStateVersion<TState> {
    const timestamp = new Date(observedAt).getTime();
    if (!Number.isFinite(timestamp)) throw new Error('Watermark timestamp must be valid');
    this.watermarkMs = Math.max(this.watermarkMs, timestamp - this.allowedLatenessMs);
    const state = this.rebuild();
    return state;
  }

  currentVersion(): RealityStateVersion<TState> {
    return this.versions[this.versions.length - 1] ?? this.snapshotFrom(this.reducer.initialState(), [], new Date(0).toISOString(), false);
  }

  versionsSnapshot(): readonly RealityStateVersion<TState>[] {
    return Object.freeze([...this.versions]);
  }

  private rebuild(): RealityStateVersion<TState> {
    const ordered = [...this.records.values()].sort((a, b) =>
      a.eventTimeMs - b.eventTimeMs || a.event.sequence - b.event.sequence || a.event.eventId.localeCompare(b.event.eventId),
    );
    let state = this.reducer.initialState();
    const eventIds: string[] = [];
    for (const record of ordered) {
      state = this.reducer.reduce(state, record.event);
      eventIds.push(record.event.eventId);
    }
    const asOf = ordered.length ? new Date(ordered[ordered.length - 1].eventTimeMs).toISOString() : new Date(0).toISOString();
    const provisional = ordered.length > 0 && ordered[ordered.length - 1].eventTimeMs > this.watermarkMs;
    const version = this.snapshotFrom(state, eventIds, asOf, provisional);
    this.versions.push(version);
    return version;
  }

  private snapshotFrom(state: TState, eventIds: readonly string[], asOf: string, provisional: boolean): RealityStateVersion<TState> {
    return Object.freeze({
      version: this.versions.length + 1,
      asOf,
      state: Object.freeze(state as TState),
      eventIds: Object.freeze([...eventIds]),
      stateHash: hash({ state, eventIds }),
      provisional,
    });
  }
}
