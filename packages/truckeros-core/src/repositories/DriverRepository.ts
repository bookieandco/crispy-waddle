import type { Coordinates, Driver } from "../types.js";
import type { InMemoryStore } from "../storage/InMemoryStore.js";
import type { SqlClient } from "../storage/SqlClient.js";

const DEMO_DRIVER_ID = "driver_demo";

export interface DriverRepository {
  /** MVP has no auth yet — every request resolves to this one seeded driver. */
  getOrCreateDemoDriver(): Promise<Driver>;
  getById(id: string): Promise<Driver | null>;
  updateCurrentLocation(id: string, coords: Coordinates): Promise<Driver>;
}

export class InMemoryDriverRepository implements DriverRepository {
  constructor(private readonly store: InMemoryStore) {}

  async getOrCreateDemoDriver(): Promise<Driver> {
    const existing = this.store.drivers.get(DEMO_DRIVER_ID);
    if (existing) return existing;

    const driver: Driver = {
      id: DEMO_DRIVER_ID,
      name: "Dorian",
      truckType: "Class 8 Sleeper Cab",
      homeBaseLocation: "Dallas, TX",
      currentLocation: null,
      preferredRadiusMeters: 16093, // ~10 miles
      createdAt: new Date().toISOString(),
    };
    this.store.drivers.set(driver.id, driver);
    return driver;
  }

  async getById(id: string): Promise<Driver | null> {
    return this.store.drivers.get(id) ?? null;
  }

  async updateCurrentLocation(id: string, coords: Coordinates): Promise<Driver> {
    const driver = this.store.drivers.get(id);
    if (!driver) throw new Error(`Driver not found: ${id}`);
    const updated: Driver = { ...driver, currentLocation: coords };
    this.store.drivers.set(id, updated);
    return updated;
  }
}

export class PostgresDriverRepository implements DriverRepository {
  constructor(private readonly db: SqlClient) {}

  async getOrCreateDemoDriver(): Promise<Driver> {
    const existing = await this.db.query<DriverRow>(
      `select * from truckeros_drivers where id = $1`,
      [DEMO_DRIVER_ID]
    );
    if (existing.rows[0]) return fromRow(existing.rows[0]);

    const inserted = await this.db.query<DriverRow>(
      `insert into truckeros_drivers (id, name, truck_type, home_base_location, preferred_radius_meters)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [DEMO_DRIVER_ID, "Dorian", "Class 8 Sleeper Cab", "Dallas, TX", 16093]
    );
    return fromRow(inserted.rows[0]);
  }

  async getById(id: string): Promise<Driver | null> {
    const result = await this.db.query<DriverRow>(`select * from truckeros_drivers where id = $1`, [id]);
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }

  async updateCurrentLocation(id: string, coords: Coordinates): Promise<Driver> {
    const result = await this.db.query<DriverRow>(
      `update truckeros_drivers set current_latitude = $2, current_longitude = $3 where id = $1 returning *`,
      [id, coords.latitude, coords.longitude]
    );
    if (!result.rows[0]) throw new Error(`Driver not found: ${id}`);
    return fromRow(result.rows[0]);
  }
}

interface DriverRow {
  id: string;
  name: string;
  truck_type: string;
  home_base_location: string | null;
  current_latitude: number | null;
  current_longitude: number | null;
  preferred_radius_meters: number;
  created_at: string;
}

function fromRow(row: DriverRow): Driver {
  return {
    id: row.id,
    name: row.name,
    truckType: row.truck_type,
    homeBaseLocation: row.home_base_location,
    currentLocation:
      row.current_latitude != null && row.current_longitude != null
        ? { latitude: row.current_latitude, longitude: row.current_longitude }
        : null,
    preferredRadiusMeters: row.preferred_radius_meters,
    createdAt: row.created_at,
  };
}
