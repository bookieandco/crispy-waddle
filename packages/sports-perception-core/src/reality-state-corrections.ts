import type { SportsEvent } from './sports-event.js';
import type { RealityStateEventResolver, RealityStateVersion, RealityStateReducer } from './reality-state-event-resolver.js';

export type RealityCorrectionKind = 'RETRACTION' | 'REPLACEMENT' | 'LATE_INSERTION' | 'SOURCE_CORRECTION';

export interface RealityCorrection {
  correctionId: string;
  targetEventId: string;
  replacementEvent?: SportsEvent;
  kind: RealityCorrectionKind;
  reason: string;
  evidenceIds: readonly string[];
  issuedAt: string;
}

export interface RealityStateDiff {
  previousVersion: number;
  nextVersion: number;
  changed: boolean;
  previousStateHash: string;
  nextStateHash: string;
  addedEventIds: readonly string[];
  removedEventIds: readonly string[];
  commonEventIds: readonly string[];
}

export interface RealityTemporalBranch<TState> {
  branchId: string;
  parentVersion: number;
  createdAt: string;
  state: RealityStateVersion<TState>;
  correction: RealityCorrection;
  diff: RealityStateDiff;
}

const validTime = (value: string): number => {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) throw new Error('Reality correction timestamp must be valid');
  return time;
};

const hash = (value: unknown): string => {
  const text = JSON.stringify(value, Object.keys(value as object).sort());
  let h = 2166136261;
  for (const char of text) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
};

const diffStates = <TState>(previous: RealityStateVersion<TState>, next: RealityStateVersion<TState>): RealityStateDiff => {
  const previousIds = new Set(previous.eventIds);
  const nextIds = new Set(next.eventIds);
  return Object.freeze({
    previousVersion: previous.version,
    nextVersion: next.version,
    changed: previous.stateHash !== next.stateHash,
    previousStateHash: previous.stateHash,
    nextStateHash: next.stateHash,
    addedEventIds: Object.freeze(next.eventIds.filter((id) => !previousIds.has(id))),
    removedEventIds: Object.freeze(previous.eventIds.filter((id) => !nextIds.has(id))),
    commonEventIds: Object.freeze(next.eventIds.filter((id) => previousIds.has(id))),
  });
};

export class RealityStateCorrectionEngine<TState> {
  private readonly corrections: RealityCorrection[] = [];
  private readonly branches: RealityTemporalBranch<TState>[] = [];

  constructor(
    private readonly resolver: RealityStateEventResolver<TState>,
    private readonly reducer: RealityStateReducer<TState>,
  ) {}

  apply(correction: RealityCorrection): RealityTemporalBranch<TState> {
    if (!correction.correctionId.trim() || !correction.targetEventId.trim()) throw new Error('Reality correction identity is required');
    if (!correction.reason.trim()) throw new Error('Reality correction reason is required');
    if (!correction.evidenceIds.length) throw new Error('Reality correction requires evidence');
    validTime(correction.issuedAt);

    const parent = this.resolver.currentVersion();
    const currentEvents = [...this.resolver.eventsSnapshot()];
    const targetExists = currentEvents.some((event) => event.eventId === correction.targetEventId);
    if (!targetExists && correction.kind !== 'LATE_INSERTION') throw new Error(`Cannot correct unknown event ${correction.targetEventId}`);
    if ((correction.kind === 'REPLACEMENT' || correction.kind === 'SOURCE_CORRECTION' || correction.kind === 'LATE_INSERTION') && !correction.replacementEvent) {
      throw new Error(`${correction.kind} requires replacementEvent`);
    }
    if (correction.replacementEvent?.gameId !== currentEvents[0]?.gameId && currentEvents.length > 0) throw new Error('Replacement event must belong to the same game');

    const replacement = correction.replacementEvent;
    const branchEvents = currentEvents.filter((event) => event.eventId !== correction.targetEventId);
    if (replacement && correction.kind !== 'RETRACTION') branchEvents.push(replacement);
    branchEvents.sort((a, b) => new Date(a.provenance.source.observedAt).getTime() - new Date(b.provenance.source.observedAt).getTime() || a.sequence - b.sequence || a.eventId.localeCompare(b.eventId));

    const branchState = this.rebuildBranch(branchEvents);
    const branch: RealityTemporalBranch<TState> = Object.freeze({
      branchId: `reality-branch:${correction.correctionId}`,
      parentVersion: parent.version,
      createdAt: correction.issuedAt,
      state: branchState,
      correction: Object.freeze({ ...correction, evidenceIds: Object.freeze([...correction.evidenceIds]) }),
      diff: diffStates(parent, branchState),
    });
    this.corrections.push(branch.correction);
    this.branches.push(branch);
    return branch;
  }

  correctionsSnapshot(): readonly RealityCorrection[] { return Object.freeze([...this.corrections]); }
  branchesSnapshot(): readonly RealityTemporalBranch<TState>[] { return Object.freeze([...this.branches]); }

  private rebuildBranch(events: readonly SportsEvent[]): RealityStateVersion<TState> {
    let state = this.reducer.initialState();
    const eventIds: string[] = [];
    for (const event of events) { state = this.reducer.reduce(state, event); eventIds.push(event.eventId); }
    const asOfMs = events.length ? Math.max(...events.map((event) => new Date(event.provenance.source.observedAt).getTime())) : 0;
    return Object.freeze({
      version: this.resolver.currentVersion().version + 1,
      asOf: new Date(asOfMs).toISOString(),
      state: Object.freeze(state),
      eventIds: Object.freeze(eventIds),
      stateHash: hash({ state, eventIds }),
      provisional: true,
    });
  }
}
