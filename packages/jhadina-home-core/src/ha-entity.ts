/**
 * Canonical Home Assistant entity and device identity types.
 *
 * B&W-6.1 FINDING 1 — baseUrl must NOT appear here.
 * Transport configuration (base URL, access token) is kept in
 * HomeAssistantTransportConfig.  Canonical records hold only normalized
 * identity, state and provenance so they are safe to store, index, and
 * pass through capability/policy boundaries without leaking credentials.
 */

export type HomeAssistantEntityDomain =
  | 'light'
  | 'switch'
  | 'media_player'
  | 'climate'
  | 'lock'
  | 'cover'
  | 'sensor'
  | 'binary_sensor'
  | 'remote'
  | 'scene'
  | 'script'
  | 'automation'
  | string; // extensible to new domains

/**
 * Normalized availability state. 'unavailable' and 'unknown' are explicit
 * values — the adapter must never silently discard them.
 */
export type HomeAssistantAvailability = 'available' | 'unavailable' | 'unknown';

/**
 * Canonical normalized Home Assistant entity record.
 *
 * Contract guarantees:
 * - `entityId` is the canonical ha:entity:<entity_id> identifier.
 * - `sourceEntityId` preserves the raw Home Assistant entity_id for provenance.
 * - No transport-specific fields (baseUrl, token, etc.) are present.
 * - `attributes` is a read-only allowlisted subset; raw HA attributes are
 *   NOT included so transport secrets cannot leak through the normalized record.
 */
export interface CanonicalHomeAssistantEntity {
  /** Jhadina canonical identifier: ha:entity:<entity_id> */
  readonly entityId: `ha:entity:${string}`;
  /** Raw Home Assistant entity_id — preserved for provenance only */
  readonly sourceEntityId: string;
  /** Home Assistant domain (light, switch, media_player, …) */
  readonly domain: HomeAssistantEntityDomain;
  /** Human-readable friendly name */
  readonly friendlyName: string;
  /** Current availability state */
  readonly availability: HomeAssistantAvailability;
  /**
   * Allowlisted normalized attributes.
   *
   * Only state-describing values (e.g. current brightness, media title)
   * belong here.  Transport details, credentials, and raw HA-internal
   * attributes must NOT appear.
   */
  readonly attributes: Readonly<Record<string, string | number | boolean | null>>;
  /** Jhadina canonical device identifier if the entity belongs to a device */
  readonly deviceId?: `ha:device:${string}`;
  /** ISO 8601 timestamp when this record was produced */
  readonly normalizedAt: string;
}

/**
 * Canonical normalized Home Assistant device record.
 *
 * B&W-6.1 FINDING 1 — deliberately excludes baseUrl, access tokens, and
 * any other transport-specific configuration.  Devices are identified by
 * their ha:device:<id> canonical identifier and hold only metadata that
 * describes device identity and provenance.
 */
export interface CanonicalHomeAssistantDevice {
  /** Jhadina canonical identifier: ha:device:<device_id> */
  readonly deviceId: `ha:device:${string}`;
  /** Raw Home Assistant device registry id — preserved for provenance only */
  readonly sourceDeviceId: string;
  /** Human-readable device name */
  readonly name: string;
  /** Device manufacturer from HA device registry */
  readonly manufacturer?: string;
  /** Device model from HA device registry */
  readonly model?: string;
  /** Canonical entity IDs belonging to this device */
  readonly entityIds: ReadonlyArray<`ha:entity:${string}`>;
  /** ISO 8601 timestamp when this record was produced */
  readonly normalizedAt: string;
}

/**
 * Transport configuration — kept entirely separate from canonical entity and
 * device records.  Only the composition root / adapter layer holds this; it
 * must never be stored alongside or merged into canonical records.
 *
 * B&W-6.1 FINDING 1 — this is where baseUrl and long-lived access tokens live,
 * not in CanonicalHomeAssistantEntity or CanonicalHomeAssistantDevice.
 */
export interface HomeAssistantTransportConfig {
  /** Home Assistant base URL, e.g. http://homeassistant.local:8123 */
  readonly baseUrl: string;
  /** Long-lived access token — NEVER included in canonical entity/device records */
  readonly accessToken: string;
}
