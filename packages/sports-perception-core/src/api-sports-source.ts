import type { ISODateTime, Sport } from './contracts.js';
import type { SportsEvent, SportsEventProvenance } from './sports-event.js';
import { freezeSportsEvent } from './sports-event.js';

export type APISportsChannel = 'DIRECT' | 'RAPIDAPI';

export interface APISportsResponseMeta {
  requestId: string;
  endpoint: string;
  observedAt: ISODateTime;
  receivedAt: ISODateTime;
  contentHash: string;
  channel: APISportsChannel;
  remainingPerMinute?: number;
  remainingPerDay?: number;
}

export interface APISportsRecord {
  sport: Sport;
  gameId: string;
  sequence: number;
  eventType: string;
  phase: SportsEvent['phase'];
  period?: number;
  clockSecondsRemaining?: number;
  participants?: SportsEvent['participants'];
  payload: Readonly<Record<string, unknown>>;
  observationClass?: SportsEvent['observationClass'];
  confidence?: number;
  derivedFromEventIds?: readonly string[];
  derivedFromObservationIds?: readonly string[];
}

export interface APISportsSourceEvent extends APISportsRecord {
  eventId: string;
  meta: APISportsResponseMeta;
}

export interface APISportsRateState {
  remainingPerMinute?: number;
  remainingPerDay?: number;
}

export function apiSportsProvenance(meta: APISportsResponseMeta, derivedFromEventIds: readonly string[] = [], derivedFromObservationIds: readonly string[] = []): SportsEventProvenance {
  if (!meta.requestId.trim() || !meta.endpoint.trim() || !meta.contentHash.trim()) {
    throw new Error('API-Sports source metadata requires requestId, endpoint, and contentHash');
  }

  return Object.freeze({
    evidenceIds: Object.freeze([`api-sports:${meta.requestId}:${meta.contentHash}`]),
    source: Object.freeze({
      sourceId: `api-sports:${meta.channel.toLowerCase()}`,
      sourceType: 'FEED',
      observedAt: meta.observedAt,
      receivedAt: meta.receivedAt,
      contentHash: meta.contentHash,
    }),
    derivedFromEventIds: derivedFromEventIds.length ? Object.freeze([...derivedFromEventIds]) : undefined,
    derivedFromObservationIds: derivedFromObservationIds.length ? Object.freeze([...derivedFromObservationIds]) : undefined,
  });
}

export function toSportsEventFromAPISports(record: APISportsSourceEvent): SportsEvent {
  const event: SportsEvent = {
    eventId: record.eventId,
    sport: record.sport,
    gameId: record.gameId,
    sequence: record.sequence,
    eventType: record.eventType,
    phase: record.phase,
    period: record.period,
    clockSecondsRemaining: record.clockSecondsRemaining,
    participants: record.participants ?? [],
    payload: record.payload,
    observationClass: record.observationClass ?? 'OBSERVED',
    confidence: record.confidence ?? 1,
    provenance: apiSportsProvenance(record.meta, record.derivedFromEventIds, record.derivedFromObservationIds),
  };

  return freezeSportsEvent(event);
}

export function readAPISportsRateState(headers: Readonly<Record<string, string | undefined>>): APISportsRateState {
  const minute = headers['X-RateLimit-Remaining'] ?? headers['x-ratelimit-remaining'];
  const day = headers['x-ratelimit-requests-remaining'] ?? headers['X-RateLimit-Requests-Remaining'];
  const parse = (value: string | undefined): number | undefined => {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  };
  return Object.freeze({ remainingPerMinute: parse(minute), remainingPerDay: parse(day) });
}

export function shouldThrottleAPISports(rate: APISportsRateState, minuteFloor = 2, dayFloor = 10): boolean {
  return (rate.remainingPerMinute !== undefined && rate.remainingPerMinute <= minuteFloor)
    || (rate.remainingPerDay !== undefined && rate.remainingPerDay <= dayFloor);
}
