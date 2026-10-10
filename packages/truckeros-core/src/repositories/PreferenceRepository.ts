import type { Preference } from "../types.js";
import type { InMemoryStore } from "../storage/InMemoryStore.js";
import type { SqlClient } from "../storage/SqlClient.js";

export interface UpsertPreferenceInput {
  driverId: string;
  key: string;
  value: string;
  weight: number;
  sourceMemoryId: string | null;
}

export interface PreferenceRepository {
  upsert(input: UpsertPreferenceInput): Promise<Preference>;
  listByDriver(driverId: string): Promise<Preference[]>;
}

export class InMemoryPreferenceRepository implements PreferenceRepository {
  constructor(private readonly store: InMemoryStore) {}

  async upsert(input: UpsertPreferenceInput): Promise<Preference> {
    const existing = Array.from(this.store.preferences.values()).find(
      (p) => p.driverId === input.driverId && p.key === input.key && p.value === input.value
    );

    const preference: Preference = {
      id: existing?.id ?? this.store.nextId("pref"),
      driverId: input.driverId,
      key: input.key,
      value: input.value,
      weight: input.weight,
      sourceMemoryId: input.sourceMemoryId,
      updatedAt: new Date().toISOString(),
    };
    this.store.preferences.set(preference.id, preference);
    return preference;
  }

  async listByDriver(driverId: string): Promise<Preference[]> {
    return Array.from(this.store.preferences.values()).filter((p) => p.driverId === driverId);
  }
}

export class PostgresPreferenceRepository implements PreferenceRepository {
  constructor(private readonly db: SqlClient) {}

  async upsert(input: UpsertPreferenceInput): Promise<Preference> {
    const id = `pref_${input.driverId}_${input.key}_${input.value}`.replace(/\s+/g, "_");
    const result = await this.db.query<PreferenceRow>(
      `insert into truckeros_preferences (id, driver_id, key, value, weight, source_memory_id, updated_at)
       values ($1,$2,$3,$4,$5,$6, now())
       on conflict (driver_id, key, value) do update set
         weight = excluded.weight, source_memory_id = excluded.source_memory_id, updated_at = now()
       returning *`,
      [id, input.driverId, input.key, input.value, input.weight, input.sourceMemoryId]
    );
    return fromRow(result.rows[0]);
  }

  async listByDriver(driverId: string): Promise<Preference[]> {
    const result = await this.db.query<PreferenceRow>(
      `select * from truckeros_preferences where driver_id = $1`,
      [driverId]
    );
    return result.rows.map(fromRow);
  }
}

interface PreferenceRow {
  id: string;
  driver_id: string;
  key: string;
  value: string;
  weight: number;
  source_memory_id: string | null;
  updated_at: string;
}

function fromRow(row: PreferenceRow): Preference {
  return {
    id: row.id,
    driverId: row.driver_id,
    key: row.key,
    value: row.value,
    weight: row.weight,
    sourceMemoryId: row.source_memory_id,
    updatedAt: row.updated_at,
  };
}
