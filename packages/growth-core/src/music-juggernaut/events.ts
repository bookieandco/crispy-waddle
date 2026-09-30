import type { GrowthEvent } from '../events/event-contract.js';

export type MusicJuggernautEventType =
  | 'music.song.ingested'
  | 'music.section.identified'
  | 'music.experiment.planned'
  | 'music.observation.received'
  | 'music.outlier.detected'
  | 'music.breakout.opened'
  | 'music.fan.captured'
  | 'music.city-demand.detected'
  | 'music.spend.decided'
  | 'music.campaign.reviewed';

export interface MusicJuggernautEvent<TPayload = unknown> extends Omit<GrowthEvent<TPayload>, 'eventType'> {
  eventType: MusicJuggernautEventType;
}

export function buildMusicJuggernautEvent<TPayload>(input: MusicJuggernautEvent<TPayload>): MusicJuggernautEvent<TPayload> {
  if (!input.eventId || !input.entityId || !input.correlationId || !input.idempotencyKey) {
    throw new Error('MUSIC_JUGGERNAUT_EVENT_IDENTITY_REQUIRED');
  }
  if (!input.actor || !input.source) throw new Error('MUSIC_JUGGERNAUT_EVENT_PROVENANCE_REQUIRED');
  if (!Number.isFinite(Date.parse(input.occurredAt))) throw new Error('MUSIC_JUGGERNAUT_EVENT_DATE_INVALID');
  return Object.freeze({...input});
}
