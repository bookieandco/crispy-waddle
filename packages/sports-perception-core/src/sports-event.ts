import type { ISODateTime, Sport } from './contracts.js';

export type SportsEventPhase = 'PRE_EVENT' | 'LIVE' | 'INTERMISSION' | 'OVERTIME' | 'FINAL' | 'UNKNOWN';
export type SportsObservationClass = 'OBSERVED' | 'INFERRED' | 'HYPOTHESIS' | 'VALIDATED' | 'CORRECTED';

export interface SportsParticipant {
  participantId: string;
  role: 'TEAM' | 'PLAYER' | 'OFFICIAL' | 'OTHER';
  side?: 'HOME' | 'AWAY' | 'NEUTRAL';
}

export interface SportsEventSource {
  sourceId: string;
  sourceType: 'FEED' | 'VIDEO' | 'TRACKER' | 'MODEL' | 'HUMAN' | 'SYSTEM';
  observedAt: ISODateTime;
  receivedAt: ISODateTime;
  sourceTimestampMs?: number;
  contentHash?: string;
}

export interface SportsEventProvenance {
  evidenceIds: readonly string[];
  source: SportsEventSource;
  derivedFromEventIds?: readonly string[];
  derivedFromObservationIds?: readonly string[];
}

export interface SportsEvent<TPayload = Readonly<Record<string, unknown>>> {
  eventId: string;
  sport: Sport;
  gameId: string;
  sequence: number;
  eventType: string;
  phase: SportsEventPhase;
  period?: number;
  clockSecondsRemaining?: number;
  participants: readonly SportsParticipant[];
  payload: TPayload;
  observationClass: SportsObservationClass;
  confidence: number;
  provenance: SportsEventProvenance;
}

export interface SportsEventAdapter<TNativeEvent, TPayload = Readonly<Record<string, unknown>>> {
  readonly sport: Sport;
  toSportsEvent(nativeEvent: TNativeEvent): SportsEvent<TPayload>;
  fromSportsEvent(event: SportsEvent<TPayload>): TNativeEvent;
}

const validIso = (value: string): boolean => Number.isFinite(new Date(value).getTime());

export function validateSportsEvent(event: SportsEvent): void {
  if (!event.eventId.trim() || !event.gameId.trim() || !event.eventType.trim()) throw new Error('Sports event identity is required');
  if (!Number.isInteger(event.sequence) || event.sequence < 1) throw new Error('Sports event sequence must be a positive integer');
  if (!validIso(event.provenance.source.observedAt) || !validIso(event.provenance.source.receivedAt)) throw new Error('Sports event timestamps must be valid ISO datetimes');
  if (new Date(event.provenance.source.receivedAt).getTime() < new Date(event.provenance.source.observedAt).getTime()) throw new Error('Sports event receivedAt cannot precede observedAt');
  if (!Number.isFinite(event.confidence) || event.confidence < 0 || event.confidence > 1) throw new Error('Sports event confidence must be within [0,1]');
  if (event.provenance.evidenceIds.length === 0) throw new Error('Sports event requires evidence');
  if (event.participants.some((participant) => !participant.participantId.trim())) throw new Error('Sports event participants require stable IDs');
  if (event.clockSecondsRemaining !== undefined && (!Number.isFinite(event.clockSecondsRemaining) || event.clockSecondsRemaining < 0)) throw new Error('Sports event clock must be non-negative');
  if (event.period !== undefined && (!Number.isInteger(event.period) || event.period < 1)) throw new Error('Sports event period must be a positive integer');
}

export function freezeSportsEvent<TPayload>(event: SportsEvent<TPayload>): SportsEvent<TPayload> {
  validateSportsEvent(event);
  return Object.freeze({
    ...event,
    participants: Object.freeze(event.participants.map((participant) => Object.freeze({ ...participant }))),
    payload: Object.freeze({ ...(event.payload as Readonly<Record<string, unknown>>) }) as TPayload,
    provenance: Object.freeze({
      ...event.provenance,
      evidenceIds: Object.freeze([...event.provenance.evidenceIds]),
      derivedFromEventIds: event.provenance.derivedFromEventIds ? Object.freeze([...event.provenance.derivedFromEventIds]) : undefined,
      derivedFromObservationIds: event.provenance.derivedFromObservationIds ? Object.freeze([...event.provenance.derivedFromObservationIds]) : undefined,
      source: Object.freeze({ ...event.provenance.source }),
    }),
  });
}

export function nextSportsEventSequence(previous: SportsEvent | undefined): number {
  return previous ? previous.sequence + 1 : 1;
}
