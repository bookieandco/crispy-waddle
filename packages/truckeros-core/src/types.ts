/**
 * TruckerOS domain types.
 *
 * These are the shapes every layer (providers, services, repositories, UI)
 * agrees on. Nothing here talks to a database or an HTTP client — that's
 * the whole point of keeping the domain layer boring.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * A single GPS fix. Whatever produces this — phone geolocation today,
 * telematics hardware later — must be able to fill every field.
 */
export interface GPSCoordinates extends Coordinates {
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number; // epoch ms
}

export const PLACE_CATEGORIES = [
  "food",
  "bbq",
  "nightlife",
  "live_music",
  "comedy",
  "attractions",
  "shopping",
  "outdoors",
  "gyms",
  "movie_theaters",
  "coffee",
  "truck_stops",
  "showers",
  "laundromats",
] as const;

export type PlaceCategorySlug = (typeof PLACE_CATEGORIES)[number];

export function isPlaceCategorySlug(value: string): value is PlaceCategorySlug {
  return (PLACE_CATEGORIES as readonly string[]).includes(value);
}

/**
 * The truck-relevant flags a place can carry. Keys match the fields called
 * out in the product spec exactly (including the literal "24_hours" key).
 */
export interface TruckAttributeFlags {
  truck_accessible: boolean | null;
  large_vehicle_parking: boolean | null;
  overnight_parking: boolean | null;
  showers: boolean | null;
  food: boolean | null;
  fuel: boolean | null;
  restrooms: boolean | null;
  "24_hours": boolean | null;
}

export type TruckAttributeKey = keyof TruckAttributeFlags;

export type AttributeSource = "provider_verified" | "user_reported" | "inferred";

/**
 * Truck attributes are bucketed by trust tier, not merged into one flat
 * object. A places API almost never actually confirms "large vehicle
 * parking" — most of what looks like truck data is inferred from address
 * text or category (e.g. "gas_station"). Keeping the buckets separate means
 * the UI can show the driver exactly how confident a claim is instead of
 * presenting a heuristic guess as fact.
 */
export interface TruckAttributes {
  verified: Partial<TruckAttributeFlags>;
  userReported: Partial<TruckAttributeFlags>;
  inferred: Partial<TruckAttributeFlags>;
}

export function emptyTruckAttributes(): TruckAttributes {
  return { verified: {}, userReported: {}, inferred: {} };
}

/** Resolved view of a single attribute: its best-known value and where it came from. */
export interface ResolvedAttribute {
  value: boolean | null;
  source: AttributeSource | "unknown";
}

/**
 * Resolve one attribute using trust precedence: verified > user-reported >
 * inferred > unknown. Never silently blends tiers into a single boolean
 * without saying which one won.
 */
export function resolveTruckAttribute(
  attrs: TruckAttributes,
  key: TruckAttributeKey
): ResolvedAttribute {
  if (attrs.verified[key] !== undefined && attrs.verified[key] !== null) {
    return { value: attrs.verified[key] as boolean, source: "provider_verified" };
  }
  if (attrs.userReported[key] !== undefined && attrs.userReported[key] !== null) {
    return { value: attrs.userReported[key] as boolean, source: "user_reported" };
  }
  if (attrs.inferred[key] !== undefined && attrs.inferred[key] !== null) {
    return { value: attrs.inferred[key] as boolean, source: "inferred" };
  }
  return { value: null, source: "unknown" };
}

export interface Place {
  id: string;
  providerId: string;
  providerName: string; // e.g. "google_places" | "mock_offline"
  name: string;
  category: PlaceCategorySlug;
  latitude: number;
  longitude: number;
  address: string | null;
  phone: string | null;
  rating: number | null;
  isOpenNow: boolean | null; // null = provider does not report hours
  truckAttributes: TruckAttributes;
  metadata: Record<string, unknown>;
}

export interface RankedPlace extends Place {
  distanceMeters: number;
  etaMinutes: number;
  routeMethod: "haversine_estimate" | "provider_directions";
  rankScore: number;
  rankReasons: string[];
}

export interface Driver {
  id: string;
  name: string;
  truckType: string;
  homeBaseLocation: string | null;
  currentLocation: Coordinates | null;
  preferredRadiusMeters: number;
  createdAt: string;
}

export interface Preference {
  id: string;
  driverId: string;
  key: string;
  value: string;
  weight: number;
  sourceMemoryId: string | null;
  updatedAt: string;
}

export interface SavedPlace {
  id: string;
  driverId: string;
  placeId: string;
  savedAt: string;
}

export interface Recommendation {
  id: string;
  driverId: string;
  placeId: string;
  runContext: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    category: PlaceCategorySlug | "all";
    rankScore: number;
  };
  generatedAt: string;
}

export type InteractionEventType =
  | "viewed"
  | "navigated"
  | "saved"
  | "dismissed"
  | "liked"
  | "disliked";

export interface Interaction {
  id: string;
  driverId: string;
  placeId: string | null;
  recommendationId: string | null;
  eventType: InteractionEventType;
  notes: string | null;
  occurredAt: string;
}

export type MemoryCandidateStatus = "pending" | "approved" | "rejected";

export interface ProposedPreference {
  key: string;
  value: string;
  weight: number;
}

export interface MemoryCandidate {
  id: string;
  driverId: string;
  observationText: string;
  proposedPreference: ProposedPreference;
  triggeredBy: string;
  status: MemoryCandidateStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Memory {
  id: string;
  driverId: string;
  memoryCandidateId: string | null;
  compiledPreferenceRule: ProposedPreference;
  appliedAt: string;
}

export type AuditActorType = "driver" | "system" | "api_gateway";

export interface AuditEvent {
  id: string;
  actorType: AuditActorType;
  actorId: string;
  eventName: string;
  payload: Record<string, unknown>;
  triggeredBy: string;
  /** null when approval status does not apply to this event */
  driverApproved: boolean | null;
  occurredAt: string;
}
