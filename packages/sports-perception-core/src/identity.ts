import type { EvidenceRecord } from './evidence-store.js';
import type { ISODateTime, Sport } from './contracts.js';

export type IdentityEntityType = 'EVENT' | 'TEAM' | 'PLAYER' | 'VENUE' | 'LEAGUE';

export interface ExternalIdentityRef {
  provider: string;
  externalId: string;
}

export interface IdentityValidityWindow {
  validFrom: ISODateTime;
  validTo?: ISODateTime;
}

export interface CanonicalEntityIdentity {
  canonicalId: string;
  entityType: IdentityEntityType;
  sport: Sport;
  names: string[];
  externalIds: ExternalIdentityRef[];
  validity: IdentityValidityWindow;
}

export interface CanonicalEventIdentity {
  eventId: string;
  sport: Sport;
  leagueId?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  scheduledAt: ISODateTime;
  venueId?: string;
  externalIds: ExternalIdentityRef[];
  evidenceIds: string[];
}

export interface TeamMembership {
  playerId: string;
  teamId: string;
  validFrom: ISODateTime;
  validTo?: ISODateTime;
  evidenceIds: string[];
}

export interface EventTimelineEntry {
  eventId: string;
  observedAt: ISODateTime;
  receivedAt: ISODateTime;
  sequence: number;
  type: string;
  payload: Readonly<Record<string, unknown>>;
  evidenceIds: string[];
}

function time(value: string): number {
  const result = new Date(value).getTime();
  if (!Number.isFinite(result)) throw new Error(`Invalid ISO datetime: ${value}`);
  return result;
}

function refKey(ref: ExternalIdentityRef): string {
  return `${ref.provider}:${ref.externalId}`;
}

function validAt(window: IdentityValidityWindow, asOf: string): boolean {
  const point = time(asOf);
  return point >= time(window.validFrom) && (window.validTo === undefined || point < time(window.validTo));
}

function normalizeAlias(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
}

export class TemporalIdentityRegistry {
  private readonly entities = new Map<string, CanonicalEntityIdentity>();
  private readonly external = new Map<string, string>();
  private readonly aliases = new Map<string, Set<string>>();

  register(entity: CanonicalEntityIdentity): void {
    if (!entity.canonicalId) throw new Error('canonicalId is required');
    if (this.entities.has(entity.canonicalId)) throw new Error(`Identity ${entity.canonicalId} already exists`);
    if (time(entity.validity.validTo ?? entity.validity.validFrom) <= time(entity.validity.validFrom) && entity.validity.validTo !== undefined) {
      throw new Error('Identity validity window must advance forward');
    }

    for (const ref of entity.externalIds) {
      const key = refKey(ref);
      const existing = this.external.get(key);
      if (existing && existing !== entity.canonicalId) {
        throw new Error(`External identity ${key} already resolves to ${existing}`);
      }
    }

    this.entities.set(entity.canonicalId, Object.freeze({ ...entity, names: Object.freeze([...entity.names]), externalIds: Object.freeze([...entity.externalIds]), validity: Object.freeze({ ...entity.validity }) }));
    for (const ref of entity.externalIds) this.external.set(refKey(ref), entity.canonicalId);
    for (const name of entity.names) {
      const key = `${entity.entityType}:${entity.sport}:${normalizeAlias(name)}`;
      const set = this.aliases.get(key) ?? new Set<string>();
      set.add(entity.canonicalId);
      this.aliases.set(key, set);
    }
  }

  resolve(ref: ExternalIdentityRef, asOf: ISODateTime): CanonicalEntityIdentity | undefined {
    const id = this.external.get(refKey(ref));
    if (!id) return undefined;
    const entity = this.entities.get(id);
    return entity && validAt(entity.validity, asOf) ? entity : undefined;
  }

  resolveAlias(entityType: IdentityEntityType, sport: Sport, alias: string, asOf: ISODateTime): CanonicalEntityIdentity | undefined {
    const ids = this.aliases.get(`${entityType}:${sport}:${normalizeAlias(alias)}`);
    if (!ids || ids.size !== 1) return undefined;
    const entity = this.entities.get([...ids][0]);
    return entity && validAt(entity.validity, asOf) ? entity : undefined;
  }
}

export class TemporalRoster {
  private readonly memberships: TeamMembership[] = [];

  addMembership(membership: TeamMembership): void {
    if (!membership.playerId || !membership.teamId || membership.evidenceIds.length === 0) {
      throw new Error('Player membership requires player, team, and evidence');
    }
    const start = time(membership.validFrom);
    const end = membership.validTo === undefined ? Number.POSITIVE_INFINITY : time(membership.validTo);
    if (end <= start) throw new Error('Membership validity window must advance forward');

    const overlaps = this.memberships.some((existing) => {
      if (existing.playerId !== membership.playerId) return false;
      const existingStart = time(existing.validFrom);
      const existingEnd = existing.validTo === undefined ? Number.POSITIVE_INFINITY : time(existing.validTo);
      return Math.max(start, existingStart) < Math.min(end, existingEnd) && existing.teamId !== membership.teamId;
    });
    if (overlaps) throw new Error(`Overlapping team memberships for player ${membership.playerId}`);
    this.memberships.push(Object.freeze({ ...membership, evidenceIds: Object.freeze([...membership.evidenceIds]) }));
  }

  teamForPlayer(playerId: string, asOf: ISODateTime): string | undefined {
    const point = time(asOf);
    const matches = this.memberships.filter((m) => point >= time(m.validFrom) && (m.validTo === undefined || point < time(m.validTo)) && m.playerId === playerId);
    if (matches.length > 1) throw new Error(`Ambiguous team membership for player ${playerId} at ${asOf}`);
    return matches[0]?.teamId;
  }
}

export class EventIdentityRegistry {
  private readonly events = new Map<string, CanonicalEventIdentity>();
  private readonly external = new Map<string, string>();

  register(event: CanonicalEventIdentity): void {
    if (this.events.has(event.eventId)) throw new Error(`Event ${event.eventId} already exists`);
    if (event.homeTeamId && event.awayTeamId && event.homeTeamId === event.awayTeamId) {
      throw new Error('Event home and away teams must differ');
    }
    for (const ref of event.externalIds) {
      const key = refKey(ref);
      const existing = this.external.get(key);
      if (existing && existing !== event.eventId) throw new Error(`External event identity ${key} already resolves to ${existing}`);
    }
    this.events.set(event.eventId, Object.freeze({ ...event, externalIds: Object.freeze([...event.externalIds]), evidenceIds: Object.freeze([...event.evidenceIds]) }));
    for (const ref of event.externalIds) this.external.set(refKey(ref), event.eventId);
  }

  resolve(ref: ExternalIdentityRef): CanonicalEventIdentity | undefined {
    const id = this.external.get(refKey(ref));
    return id ? this.events.get(id) : undefined;
  }
}

export class EventTimeline {
  private readonly entries: EventTimelineEntry[] = [];

  append(entry: EventTimelineEntry): void {
    if (!entry.eventId || !entry.type || entry.evidenceIds.length === 0) throw new Error('Timeline entry requires event, type, and evidence');
    time(entry.observedAt);
    time(entry.receivedAt);
    if (time(entry.receivedAt) < time(entry.observedAt)) throw new Error('Timeline receivedAt cannot precede observedAt');
    if (entry.payload === undefined) throw new Error('Timeline payload is required');
    this.entries.push(Object.freeze({ ...entry, payload: Object.freeze({ ...entry.payload }), evidenceIds: Object.freeze([...entry.evidenceIds]) }));
  }

  forEvent(eventId: string, asOf: ISODateTime): readonly EventTimelineEntry[] {
    const cutoff = time(asOf);
    return Object.freeze(this.entries
      .filter((entry) => entry.eventId === eventId && time(entry.receivedAt) <= cutoff)
      .sort((a, b) => time(a.observedAt) - time(b.observedAt) || time(a.receivedAt) - time(b.receivedAt) || a.evidenceIds.join(',').localeCompare(b.evidenceIds.join(',')) || a.sequence - b.sequence));
  }
}

export function timelineFromEvidence(records: readonly EvidenceRecord[], eventId: string): EventTimelineEntry[] {
  return records
    .filter((record) => record.eventId === eventId && record.domain === 'WORLD')
    .map((record, index) => ({
      eventId,
      observedAt: record.observedAt,
      receivedAt: record.receivedAt,
      sequence: index,
      type: typeof record.payload.type === 'string' ? record.payload.type : 'OBSERVATION',
      payload: record.payload,
      evidenceIds: [record.observationId],
    }));
}
