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
    const priorIds = new Set(parent.eventIds);
    if (!priorIds.has(correction.targetEventId) && correction.kind !== 'LATE_INSERTION') {
      throw new Error(`Cannot correct unknown event ${correction.targetEventId}`);
    }
    if ((correction.kind === 'REPLACEMENT' || correction.kind === 'SOURCE_CORRECTION' || correction.kind === 'LATE_INSERTION') && !correction.replacementEvent) {
      throw new Error(`${correction.kind} requires replacementEvent`);
    }

    const replacement = correction.replacementEvent;
    const currentEvents = parent.eventIds;
    const branchEvents: SportsEvent[] = [];
    for (const eventId of currentEvents) {
      if (eventId === correction.targetEventId) {
        if (replacement) branchEvents.push(replacement);
        continue;
      }
    }

    const branchState = this.rebuildBranch(branchEvents, replacement && correction.kind === 'LATE_INSERTION' ? [...currentEvents, replacement.eventId] : currentEvents);
    const diff = diffStates(parent, branchState);
    const branch: RealityTemporalBranch<TState> = Object.freeze({
      branchId: `reality-branch:${correction.correctionId}`,
      parentVersion: parent.version,
      createdAt: correction.issuedAt,
      state: branchState,
      correction: Object.freeze({ ...correction, evidenceIds: Object.freeze([...correction.evidenceIds]) }),
      diff,
    });
    this.corrections.push(branch.correction);
    this.branches.push(branch);
    return branch;
  }

  correctionsSnapshot(): readonly RealityCorrection[] {
    return Object.freeze([...this.corrections]);
  }

  branchesSnapshot(): readonly RealityTemporalBranch<TState>[] {
    return Object.freeze([...this.branches]);
  }

  private rebuildBranch(events: readonly SportsEvent[], eventIds: readonly string[]): RealityStateVersion<TState> {
    let state = this.reducer.initialState();
    for (const event of events) state = this.reducer.reduce(state, event);
    const asOf = events.length ? events.map((e) => new Date(e.provenance.source.observedAt).getTime()).sort((a, b) => b - a)[0] : 0;
    return Object.freeze({
      version: this.resolver.currentVersion().version + 1,
      asOf: new Date(asOf).toISOString(),
      state: Object.freeze(state),
      eventIds: Object.freeze([...eventIds]),
      stateHash: `${this.resolver.currentVersion().stateHash}:branch:${JSON.stringify(state)}:${eventIds.join('|')}`,
      provisional: true,
    });
  }
}
