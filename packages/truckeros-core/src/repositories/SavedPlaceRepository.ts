import type { SavedPlace } from "../types.js";
import type { InMemoryStore } from "../storage/InMemoryStore.js";
import type { SqlClient } from "../storage/SqlClient.js";

export interface SavedPlaceRepository {
  save(driverId: string, placeId: string): Promise<SavedPlace>;
  listByDriver(driverId: string): Promise<SavedPlace[]>;
}

export class InMemorySavedPlaceRepository implements SavedPlaceRepository {
  constructor(private readonly store: InMemoryStore) {}

  async save(driverId: string, placeId: string): Promise<SavedPlace> {
    const existing = Array.from(this.store.savedPlaces.values()).find(
      (s) => s.driverId === driverId && s.placeId === placeId
    );
    if (existing) return existing;

    const saved: SavedPlace = {
      id: this.store.nextId("saved"),
      driverId,
      placeId,
      savedAt: new Date().toISOString(),
    };
    this.store.savedPlaces.set(saved.id, saved);
    return saved;
  }

  async listByDriver(driverId: string): Promise<SavedPlace[]> {
    return Array.from(this.store.savedPlaces.values())
      .filter((s) => s.driverId === driverId)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }
}

export class PostgresSavedPlaceRepository implements SavedPlaceRepository {
  constructor(private readonly db: SqlClient) {}

  async save(driverId: string, placeId: string): Promise<SavedPlace> {
    const id = `saved_${driverId}_${placeId}`;
    const result = await this.db.query<SavedPlaceRow>(
      `insert into truckeros_saved_places (id, driver_id, place_id)
       values ($1,$2,$3)
       on conflict (driver_id, place_id) do update set driver_id = excluded.driver_id
       returning *`,
      [id, driverId, placeId]
    );
    return fromRow(result.rows[0]);
  }

  async listByDriver(driverId: string): Promise<SavedPlace[]> {
    const result = await this.db.query<SavedPlaceRow>(
      `select * from truckeros_saved_places where driver_id = $1 order by saved_at desc`,
      [driverId]
    );
    return result.rows.map(fromRow);
  }
}

interface SavedPlaceRow {
  id: string;
  driver_id: string;
  place_id: string;
  saved_at: string;
}

function fromRow(row: SavedPlaceRow): SavedPlace {
  return { id: row.id, driverId: row.driver_id, placeId: row.place_id, savedAt: row.saved_at };
}
