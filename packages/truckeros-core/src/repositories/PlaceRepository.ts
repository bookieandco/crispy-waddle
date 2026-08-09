import type { Place, PlaceCategorySlug, TruckAttributes } from "../types.js";
import type { InMemoryStore } from "../storage/InMemoryStore.js";
import type { SqlClient } from "../storage/SqlClient.js";

export interface UpsertPlaceInput {
  providerId: string;
  providerName: string;
  name: string;
  category: PlaceCategorySlug;
  latitude: number;
  longitude: number;
  address: string | null;
  phone: string | null;
  rating: number | null;
  isOpenNow: boolean | null;
  truckAttributes: TruckAttributes;
}

export interface PlaceRepository {
  /** Cache/refresh a place from a provider search result. Idempotent per (providerName, providerId). */
  upsert(input: UpsertPlaceInput): Promise<Place>;
  getById(id: string): Promise<Place | null>;
}

export class InMemoryPlaceRepository implements PlaceRepository {
  constructor(private readonly store: InMemoryStore) {}

  async upsert(input: UpsertPlaceInput): Promise<Place> {
    const key = `${input.providerName}:${input.providerId}`;
    const existingId = this.store.placesByProviderKey.get(key);

    if (existingId) {
      const existing = this.store.places.get(existingId);
      if (existing) {
        const updated: Place = {
          ...existing,
          name: input.name,
          category: input.category,
          latitude: input.latitude,
          longitude: input.longitude,
          address: input.address,
          phone: input.phone,
          rating: input.rating,
          isOpenNow: input.isOpenNow,
          truckAttributes: {
            verified: input.truckAttributes.verified,
            inferred: input.truckAttributes.inferred,
            // Driver-reported signals persist across a provider refresh —
            // a fresh API fetch shouldn't erase what a driver told us.
            userReported: existing.truckAttributes.userReported,
          },
        };
        this.store.places.set(existingId, updated);
        return updated;
      }
    }

    const id = this.store.nextId("place");
    const place: Place = {
      id,
      providerId: input.providerId,
      providerName: input.providerName,
      name: input.name,
      category: input.category,
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address,
      phone: input.phone,
      rating: input.rating,
      isOpenNow: input.isOpenNow,
      truckAttributes: input.truckAttributes,
      metadata: {},
    };
    this.store.places.set(id, place);
    this.store.placesByProviderKey.set(key, id);
    return place;
  }

  async getById(id: string): Promise<Place | null> {
    return this.store.places.get(id) ?? null;
  }
}

export class PostgresPlaceRepository implements PlaceRepository {
  constructor(private readonly db: SqlClient) {}

  async upsert(input: UpsertPlaceInput): Promise<Place> {
    const id = `place_${input.providerName}_${input.providerId}`;
    const result = await this.db.query<PlaceRow>(
      `insert into truckeros_places
         (id, provider_id, provider_name, name, category_slug, latitude, longitude,
          address, phone, rating, is_open_now,
          truck_attributes_verified, truck_attributes_user_reported, truck_attributes_inferred,
          updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb, now())
       on conflict (provider_name, provider_id) do update set
         name = excluded.name,
         category_slug = excluded.category_slug,
         latitude = excluded.latitude,
         longitude = excluded.longitude,
         address = excluded.address,
         phone = excluded.phone,
         rating = excluded.rating,
         is_open_now = excluded.is_open_now,
         truck_attributes_verified = excluded.truck_attributes_verified,
         truck_attributes_inferred = excluded.truck_attributes_inferred,
         updated_at = now()
       returning *`,
      [
        id,
        input.providerId,
        input.providerName,
        input.name,
        input.category,
        input.latitude,
        input.longitude,
        input.address,
        input.phone,
        input.rating,
        input.isOpenNow,
        JSON.stringify(input.truckAttributes.verified),
        JSON.stringify(input.truckAttributes.userReported),
        JSON.stringify(input.truckAttributes.inferred),
      ]
    );
    return fromRow(result.rows[0]);
  }

  async getById(id: string): Promise<Place | null> {
    const result = await this.db.query<PlaceRow>(`select * from truckeros_places where id = $1`, [id]);
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }
}

interface PlaceRow {
  id: string;
  provider_id: string;
  provider_name: string;
  name: string;
  category_slug: PlaceCategorySlug;
  latitude: number;
  longitude: number;
  address: string | null;
  phone: string | null;
  rating: number | null;
  is_open_now: boolean | null;
  truck_attributes_verified: TruckAttributes["verified"];
  truck_attributes_user_reported: TruckAttributes["userReported"];
  truck_attributes_inferred: TruckAttributes["inferred"];
}

function fromRow(row: PlaceRow): Place {
  return {
    id: row.id,
    providerId: row.provider_id,
    providerName: row.provider_name,
    name: row.name,
    category: row.category_slug,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    phone: row.phone,
    rating: row.rating,
    isOpenNow: row.is_open_now,
    truckAttributes: {
      verified: row.truck_attributes_verified ?? {},
      userReported: row.truck_attributes_user_reported ?? {},
      inferred: row.truck_attributes_inferred ?? {},
    },
    metadata: {},
  };
}
