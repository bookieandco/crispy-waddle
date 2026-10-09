/**
 * InMemoryStore
 *
 * Pure storage. No business logic — that lives in the repositories that
 * wrap this. All data is lost on process restart, by design, for the
 * prototype. Every InMemory*Repository in ../repositories shares one of
 * these instances so a saved place, a recorded interaction, and an
 * approved memory are all visible to each other within a session.
 */

import type {
  AuditEvent,
  Driver,
  Interaction,
  Memory,
  MemoryCandidate,
  Place,
  Preference,
  Recommendation,
  SavedPlace,
} from "../types.js";

export class InMemoryStore {
  drivers = new Map<string, Driver>();
  locations: { driverId: string; latitude: number; longitude: number; accuracy: number | null; heading: number | null; speed: number | null; recordedAt: string }[] = [];
  places = new Map<string, Place>();
  placesByProviderKey = new Map<string, string>(); // `${providerName}:${providerId}` -> place id
  savedPlaces = new Map<string, SavedPlace>();
  preferences = new Map<string, Preference>();
  recommendations = new Map<string, Recommendation>();
  interactions = new Map<string, Interaction>();
  memoryCandidates = new Map<string, MemoryCandidate>();
  memories = new Map<string, Memory>();
  auditEvents: AuditEvent[] = [];

  private counters: Record<string, number> = {};

  nextId(prefix: string): string {
    this.counters[prefix] = (this.counters[prefix] ?? 0) + 1;
    return `${prefix}_${this.counters[prefix]}`;
  }

  clear(): void {
    this.drivers.clear();
    this.locations = [];
    this.places.clear();
    this.placesByProviderKey.clear();
    this.savedPlaces.clear();
    this.preferences.clear();
    this.recommendations.clear();
    this.interactions.clear();
    this.memoryCandidates.clear();
    this.memories.clear();
    this.auditEvents = [];
    this.counters = {};
  }
}

/** Process-wide singleton, matching @jhadina/jhadina-web's storage pattern. */
export const store = new InMemoryStore();
