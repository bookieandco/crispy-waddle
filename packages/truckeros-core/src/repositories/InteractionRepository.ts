import type { Interaction, InteractionEventType } from "../types.js";
import type { InMemoryStore } from "../storage/InMemoryStore.js";
import type { SqlClient } from "../storage/SqlClient.js";

export interface RecordInteractionInput {
  driverId: string;
  placeId: string | null;
  recommendationId: string | null;
  eventType: InteractionEventType;
  notes: string | null;
}

export interface InteractionRepository {
  record(input: RecordInteractionInput): Promise<Interaction>;
  listByDriver(driverId: string, limit?: number): Promise<Interaction[]>;
}

export class InMemoryInteractionRepository implements InteractionRepository {
  constructor(private readonly store: InMemoryStore) {}

  async record(input: RecordInteractionInput): Promise<Interaction> {
    const interaction: Interaction = {
      id: this.store.nextId("interaction"),
      driverId: input.driverId,
      placeId: input.placeId,
      recommendationId: input.recommendationId,
      eventType: input.eventType,
      notes: input.notes,
      occurredAt: new Date().toISOString(),
    };
    this.store.interactions.set(interaction.id, interaction);
    return interaction;
  }

  async listByDriver(driverId: string, limit = 50): Promise<Interaction[]> {
    return Array.from(this.store.interactions.values())
      .filter((i) => i.driverId === driverId)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, limit);
  }
}

export class PostgresInteractionRepository implements InteractionRepository {
  constructor(private readonly db: SqlClient) {}

  async record(input: RecordInteractionInput): Promise<Interaction> {
    const id = `interaction_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query<InteractionRow>(
      `insert into truckeros_interactions (id, driver_id, place_id, recommendation_id, event_type, notes)
       values ($1,$2,$3,$4,$5,$6)
       returning *`,
      [id, input.driverId, input.placeId, input.recommendationId, input.eventType, input.notes]
    );
    return fromRow(result.rows[0]);
  }

  async listByDriver(driverId: string, limit = 50): Promise<Interaction[]> {
    const result = await this.db.query<InteractionRow>(
      `select * from truckeros_interactions where driver_id = $1 order by occurred_at desc limit $2`,
      [driverId, limit]
    );
    return result.rows.map(fromRow);
  }
}

interface InteractionRow {
  id: string;
  driver_id: string;
  place_id: string | null;
  recommendation_id: string | null;
  event_type: InteractionEventType;
  notes: string | null;
  occurred_at: string;
}

function fromRow(row: InteractionRow): Interaction {
  return {
    id: row.id,
    driverId: row.driver_id,
    placeId: row.place_id,
    recommendationId: row.recommendation_id,
    eventType: row.event_type,
    notes: row.notes,
    occurredAt: row.occurred_at,
  };
}
