import type { SupabaseClient } from '@supabase/supabase-js';
import type { EntityStateStore, HomeEntityState, IdempotencyStore } from '@jhadina/home-core';
import { createServiceRoleClient } from '../supabase/service-role.js';

/** B&W-6.2 production persistence adapters; Supabase stays outside home-core. */
export type HomePersistenceClient = SupabaseClient;

type EntityStateRow = {
  entity_id: string;
  domain: HomeEntityState['domain'];
  friendly_name: string;
  availability: HomeEntityState['availability'];
  attributes: HomeEntityState['attributes'];
  provider: 'home-assistant';
  source_entity_id: string;
  source_event_id: string;
  state_at: string;
  timestamp_missing: boolean;
  updated_at: string;
  correlation_id: string | null;
  causation_id: string | null;
};

function toState(row: EntityStateRow): HomeEntityState {
  return Object.freeze({
    entityId: row.entity_id as HomeEntityState['entityId'],
    domain: row.domain,
    friendlyName: row.friendly_name,
    availability: row.availability,
    attributes: row.attributes,
    provider: row.provider,
    sourceEntityId: row.source_entity_id,
    sourceEventId: row.source_event_id,
    stateAt: row.state_at,
    timestampMissing: row.timestamp_missing,
    updatedAt: row.updated_at,
    ...(row.correlation_id ? { correlationId: row.correlation_id } : {}),
    ...(row.causation_id ? { causationId: row.causation_id } : {}),
  });
}

export class SupabaseHomeIdempotencyStore implements IdempotencyStore {
  constructor(private readonly client: HomePersistenceClient) {}

  async hasSeen(eventId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('jhadina_home_ingestion_idempotency')
      .select('event_id')
      .eq('event_id', eventId)
      .eq('status', 'completed')
      .maybeSingle();
    if (error) throw new Error(`HOME_IDEMPOTENCY_LOOKUP_FAILED: ${error.message}`);
    return data !== null;
  }

  async claim(eventId: string, entityId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('jhadina_home_ingestion_idempotency')
      .upsert(
        { event_id: eventId, entity_id: entityId, status: 'processing' },
        { onConflict: 'event_id', ignoreDuplicates: true },
      )
      .select('event_id')
      .maybeSingle();
    if (error) throw new Error(`HOME_IDEMPOTENCY_CLAIM_FAILED: ${error.message}`);
    return data !== null;
  }

  async markSeen(eventId: string, entityId: string): Promise<void> {
    const { data, error } = await this.client
      .from('jhadina_home_ingestion_idempotency')
      .update({ status: 'completed', completed_at: new Date().toISOString(), entity_id: entityId })
      .eq('event_id', eventId)
      .eq('status', 'processing')
      .select('event_id')
      .maybeSingle();
    if (error) throw new Error(`HOME_IDEMPOTENCY_COMPLETE_FAILED: ${error.message}`);
    if (!data) throw new Error('HOME_IDEMPOTENCY_NOT_CLAIMED');
  }

  async release(eventId: string): Promise<void> {
    const { error } = await this.client
      .from('jhadina_home_ingestion_idempotency')
      .delete()
      .eq('event_id', eventId)
      .eq('status', 'processing');
    if (error) throw new Error(`HOME_IDEMPOTENCY_RELEASE_FAILED: ${error.message}`);
  }
}

export class SupabaseHomeEntityStateStore implements EntityStateStore {
  constructor(private readonly client: HomePersistenceClient) {}

  async get(entityId: string): Promise<HomeEntityState | undefined> {
    const { data, error } = await this.client
      .from('jhadina_home_entity_state')
      .select('*')
      .eq('entity_id', entityId)
      .maybeSingle<EntityStateRow>();
    if (error) throw new Error(`HOME_STATE_LOOKUP_FAILED: ${error.message}`);
    return data ? toState(data) : undefined;
  }

  async set(state: HomeEntityState, expectedStateAt?: string): Promise<boolean> {
    const row = {
      entity_id: state.entityId,
      domain: state.domain,
      friendly_name: state.friendlyName,
      availability: state.availability,
      attributes: state.attributes,
      provider: state.provider,
      source_entity_id: state.sourceEntityId,
      source_event_id: state.sourceEventId,
      state_at: state.stateAt,
      timestamp_missing: state.timestampMissing,
      updated_at: state.updatedAt,
      correlation_id: state.correlationId ?? null,
      causation_id: state.causationId ?? null,
    };

    if (expectedStateAt === undefined) {
      const { data, error } = await this.client
        .from('jhadina_home_entity_state')
        .insert(row)
        .select('entity_id')
        .maybeSingle();
      if (error) {
        if (error.code === '23505') return false;
        throw new Error(`HOME_STATE_INSERT_FAILED: ${error.message}`);
      }
      return data !== null;
    }

    const { data, error } = await this.client
      .from('jhadina_home_entity_state')
      .update(row)
      .eq('entity_id', state.entityId)
      .eq('state_at', expectedStateAt)
      .select('entity_id')
      .maybeSingle();
    if (error) throw new Error(`HOME_STATE_CAS_FAILED: ${error.message}`);
    return data !== null;
  }

  async list(): Promise<readonly HomeEntityState[]> {
    const { data, error } = await this.client
      .from('jhadina_home_entity_state')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw new Error(`HOME_STATE_LIST_FAILED: ${error.message}`);
    return (data as EntityStateRow[]).map(toState);
  }
}

export function createDurableHomeStores(client: HomePersistenceClient | null): {
  idempotency: SupabaseHomeIdempotencyStore;
  stateStore: SupabaseHomeEntityStateStore;
} {
  if (!client) throw new Error('HOME_DURABLE_STORAGE_UNAVAILABLE');
  return {
    idempotency: new SupabaseHomeIdempotencyStore(client),
    stateStore: new SupabaseHomeEntityStateStore(client),
  };
}

/** Production composition root helper: no silent in-memory fallback. */
export function createProductionHomeStores(): {
  idempotency: SupabaseHomeIdempotencyStore;
  stateStore: SupabaseHomeEntityStateStore;
} {
  const client = createServiceRoleClient();
  if (!client && process.env.NODE_ENV === 'production') {
    throw new Error('HOME_DURABLE_STORAGE_UNAVAILABLE');
  }
  return createDurableHomeStores(client);
}
