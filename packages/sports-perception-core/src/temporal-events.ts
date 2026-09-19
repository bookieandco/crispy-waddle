import type { ISODateTime, Sport } from './contracts.js';
import type { EventTimelineEntry } from './identity.js';

export type TemporalRelation = 'BEFORE' | 'AFTER' | 'DURING' | 'OVERLAPS' | 'MEETS' | 'EQUALS';

export interface TemporalInterval {
  start: ISODateTime;
  end?: ISODateTime;
}

export interface EventCandidate {
  candidateId: string;
  eventId: string;
  sport: Sport;
  type: string;
  interval: TemporalInterval;
  subjectIds: string[];
  confidence: number;
  evidenceIds: string[];
  source: 'VISION' | 'TRACKING' | 'ANNOTATION' | 'OFFICIAL_FEED' | 'OTHER';
}

export interface ReconstructedEvent {
  eventId: string;
  sport: Sport;
  type: string;
  interval: TemporalInterval;
  subjectIds: string[];
  evidenceIds: string[];
  candidateIds: string[];
  confidence: number;
  canonical: boolean;
}

function timestamp(value: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ISO datetime: ${value}`);
  return parsed;
}

function validateInterval(interval: TemporalInterval): void {
  const start = timestamp(interval.start);
  if (interval.end !== undefined && timestamp(interval.end) < start) {
    throw new Error('Temporal interval end cannot precede start');
  }
}

function overlap(a: TemporalInterval, b: TemporalInterval): boolean {
  const aStart = timestamp(a.start);
  const bStart = timestamp(b.start);
  const aEnd = a.end === undefined ? Number.POSITIVE_INFINITY : timestamp(a.end);
  const bEnd = b.end === undefined ? Number.POSITIVE_INFINITY : timestamp(b.end);
  return Math.max(aStart, bStart) <= Math.min(aEnd, bEnd);
}

export function temporalRelation(a: TemporalInterval, b: TemporalInterval): TemporalRelation {
  validateInterval(a);
  validateInterval(b);
  const as = timestamp(a.start);
  const bs = timestamp(b.start);
  const ae = a.end === undefined ? Number.POSITIVE_INFINITY : timestamp(a.end);
  const be = b.end === undefined ? Number.POSITIVE_INFINITY : timestamp(b.end);
  if (as === bs && ae === be) return 'EQUALS';
  if (ae < bs) return 'BEFORE';
  if (be < as) return 'AFTER';
  if (as >= bs && ae <= be) return 'DURING';
  if (bs >= as && be <= ae) return 'DURING';
  if (ae === bs || be === as) return 'MEETS';
  return 'OVERLAPS';
}

export class TemporalEventReconstructor {
  private readonly candidates: EventCandidate[] = [];

  addCandidate(candidate: EventCandidate): void {
    if (!candidate.candidateId || !candidate.eventId || !candidate.type) {
      throw new Error('Event candidate requires candidateId, eventId, and type');
    }
    if (candidate.evidenceIds.length === 0) throw new Error('Event candidate requires evidence');
    if (!Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1) {
      throw new Error('Event candidate confidence must be between 0 and 1');
    }
    validateInterval(candidate.interval);
    if (this.candidates.some((item) => item.candidateId === candidate.candidateId)) {
      throw new Error(`Event candidate ${candidate.candidateId} already exists`);
    }
    this.candidates.push(Object.freeze({
      ...candidate,
      subjectIds: Object.freeze([...candidate.subjectIds]),
      evidenceIds: Object.freeze([...candidate.evidenceIds]),
    }));
  }

  reconstruct(eventId: string, asOf: ISODateTime, minimumConfidence = 0.5): readonly ReconstructedEvent[] {
    const cutoff = timestamp(asOf);
    if (minimumConfidence < 0 || minimumConfidence > 1) throw new Error('minimumConfidence must be between 0 and 1');

    const eligible = this.candidates.filter((candidate) =>
      candidate.eventId === eventId &&
      candidate.confidence >= minimumConfidence &&
      timestamp(candidate.interval.start) <= cutoff,
    );

    const groups = new Map<string, EventCandidate[]>();
    for (const candidate of eligible) {
      const key = `${candidate.type}:${[...candidate.subjectIds].sort().join(',')}`;
      const group = groups.get(key) ?? [];
      group.push(candidate);
      groups.set(key, group);
    }

    const reconstructed: ReconstructedEvent[] = [];
    for (const group of groups.values()) {
      const ordered = [...group].sort((a, b) => b.confidence - a.confidence || a.candidateId.localeCompare(b.candidateId));
      const first = ordered[0];
      const interval = ordered.reduce((current, candidate) => {
        if (!overlap(current, candidate.interval)) return current;
        const start = timestamp(current.start) <= timestamp(candidate.interval.start) ? current.start : candidate.interval.start;
        const currentEnd = current.end === undefined ? Number.POSITIVE_INFINITY : timestamp(current.end);
        const candidateEnd = candidate.interval.end === undefined ? Number.POSITIVE_INFINITY : timestamp(candidate.interval.end);
        const endValue = Math.max(currentEnd, candidateEnd);
        return { start, end: Number.isFinite(endValue) ? new Date(endValue).toISOString() : undefined };
      }, first.interval);

      const evidenceIds = [...new Set(ordered.flatMap((candidate) => candidate.evidenceIds))].sort();
      reconstructed.push(Object.freeze({
        eventId,
        sport: first.sport,
        type: first.type,
        interval,
        subjectIds: Object.freeze([...first.subjectIds].sort()),
        evidenceIds: Object.freeze(evidenceIds),
        candidateIds: Object.freeze(ordered.map((candidate) => candidate.candidateId)),
        confidence: Math.max(...ordered.map((candidate) => candidate.confidence)),
        canonical: true,
      }));
    }

    return Object.freeze(reconstructed.sort((a, b) =>
      timestamp(a.interval.start) - timestamp(b.interval.start) ||
      a.type.localeCompare(b.type) ||
      a.evidenceIds.join(',').localeCompare(b.evidenceIds.join(',')),
    ));
  }
}

export interface TimelineReconstructionInput {
  eventId: string;
  sport: Sport;
  timeline: readonly EventTimelineEntry[];
  asOf: ISODateTime;
}

export function candidatesFromTimeline(input: TimelineReconstructionInput): EventCandidate[] {
  const cutoff = timestamp(input.asOf);
  return input.timeline
    .filter((entry) => entry.eventId === input.eventId && timestamp(entry.receivedAt) <= cutoff)
    .map((entry) => ({
      candidateId: `${entry.eventId}:${entry.sequence}:${entry.evidenceIds.join('-')}`,
      eventId: input.eventId,
      sport: input.sport,
      type: typeof entry.payload.type === 'string' ? entry.payload.type : entry.type,
      interval: {
        start: entry.observedAt,
        end: typeof entry.payload.endTime === 'string' ? entry.payload.endTime : undefined,
      },
      subjectIds: Array.isArray(entry.payload.subjectIds)
        ? entry.payload.subjectIds.filter((id): id is string => typeof id === 'string')
        : [],
      confidence: typeof entry.payload.confidence === 'number' ? entry.payload.confidence : 1,
      evidenceIds: [...entry.evidenceIds],
      source: entry.payload.source === 'ANNOTATION' ? 'ANNOTATION' : 'OTHER',
    }));
}
