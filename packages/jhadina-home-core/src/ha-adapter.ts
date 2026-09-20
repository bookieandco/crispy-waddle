/**
 * DeterministicHomeAssistantAdapter — B&W-6.1
 *
 * Normalizes raw Home Assistant state objects into canonical
 * CanonicalHomeAssistantEntity records.
 *
 * Contract guarantees (Issue #200 B&W-6.1 acceptance criteria):
 * 1. Adapter is independent of HTTP/UI code.
 * 2. Entities are converted to canonical ha:entity:* identifiers.
 * 3. Normalization is deterministic and preserves source provenance.
 * 4. Capabilities are derived from domain/service support, not hardcoded.
 * 5. No HA credentials or base URLs appear in normalized entities.
 * 6. Adapter failures are explicit — unsupported domains produce no capabilities.
 */

import type {
  CanonicalHomeAssistantEntity,
  CanonicalHomeAssistantDevice,
  HomeAssistantAvailability,
  HomeAssistantEntityDomain,
} from './ha-entity.js';
import { supportedActionsForDomain } from './ha-service-map.js';

/**
 * Raw Home Assistant entity state as returned by the HA REST API
 * `GET /api/states` or `GET /api/states/<entity_id>`.
 *
 * Only the fields the adapter needs are declared here; extra fields from
 * the HA response are intentionally not captured (they may contain
 * internal HA metadata that should not bleed into canonical records).
 */
export interface RawHomeAssistantState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed?: string;
  last_updated?: string;
}

/**
 * Raw Home Assistant device registry entry.
 */
export interface RawHomeAssistantDevice {
  id: string;
  name: string;
  manufacturer?: string | null;
  model?: string | null;
}

/**
 * Result of normalizing a raw HA state.
 *
 * - `ok`: true when the entity was normalized successfully.
 * - `ok`: false when normalization was rejected (e.g. unsupported domain
 *   for a capability-producing path); the `reason` explains why.
 * Adapter failures are explicit — callers must not assume success.
 */
export type NormalizationResult =
  | { ok: true; entity: CanonicalHomeAssistantEntity; actions: readonly string[] }
  | { ok: false; reason: string; sourceEntityId: string };

/**
 * Safe attribute allowlist: only string/number/boolean/null values from
 * a known safe subset of HA attribute names are included.
 *
 * This prevents any transport secrets (tokens, URLs, internal IDs) from
 * leaking into the canonical entity record through the attributes field.
 */
const SAFE_ATTRIBUTE_KEYS: ReadonlySet<string> = new Set([
  'brightness', 'brightness_pct', 'color_temp', 'rgb_color',
  'friendly_name', 'icon', 'assumed_state', 'unit_of_measurement',
  'device_class', 'state_class', 'media_title', 'media_artist',
  'media_album_name', 'media_content_type', 'volume_level', 'is_volume_muted',
  'current_temperature', 'target_temp_high', 'target_temp_low',
  'hvac_mode', 'hvac_action', 'preset_mode',
  'current_position', 'is_locked',
]);

function extractSafeAttributes(
  raw: Record<string, unknown>,
): Readonly<Record<string, string | number | boolean | null>> {
  const result: Record<string, string | number | boolean | null> = {};
  for (const key of SAFE_ATTRIBUTE_KEYS) {
    const value = raw[key];
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      result[key] = value;
    }
  }
  return Object.freeze(result);
}

function deriveAvailability(state: string): HomeAssistantAvailability {
  if (state === 'unavailable') return 'unavailable';
  if (state === 'unknown') return 'unknown';
  return 'available';
}

function deriveFriendlyName(
  entityId: string,
  attributes: Record<string, unknown>,
): string {
  const fn = attributes['friendly_name'];
  if (typeof fn === 'string' && fn.trim()) return fn.trim();
  // Fallback: humanize entity_id (light.living_room → Living Room)
  return entityId
    .replace(/^[^.]+\./, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Deterministic Home Assistant entity adapter.
 *
 * B&W-6.1: normalizes raw HA states into canonical entity records.
 * Transport configuration is never passed to or held by this adapter —
 * it operates purely on raw state objects that the HTTP transport layer
 * provides externally.
 */
export class DeterministicHomeAssistantAdapter {
  /**
   * Normalize a raw HA state into a canonical entity record.
   *
   * The `normalizedAt` timestamp is injected rather than using Date.now()
   * directly so tests can verify deterministic output without wall-clock
   * dependence.
   */
  normalizeEntity(
    raw: RawHomeAssistantState,
    normalizedAt: string = new Date().toISOString(),
  ): NormalizationResult {
    const entityId = raw.entity_id;
    if (!entityId || typeof entityId !== 'string') {
      return { ok: false, reason: 'entity_id is missing or invalid', sourceEntityId: String(entityId) };
    }

    const domainPart = entityId.split('.')[0] as HomeAssistantEntityDomain;
    if (!domainPart) {
      return { ok: false, reason: `Cannot derive domain from entity_id: ${entityId}`, sourceEntityId: entityId };
    }

    const availability = deriveAvailability(raw.state);
    const friendlyName = deriveFriendlyName(entityId, raw.attributes);
    const safeAttributes = extractSafeAttributes(raw.attributes);
    const actions = supportedActionsForDomain(domainPart);

    const entity: CanonicalHomeAssistantEntity = Object.freeze({
      entityId: `ha:entity:${entityId}` as `ha:entity:${string}`,
      sourceEntityId: entityId,
      domain: domainPart,
      friendlyName,
      availability,
      attributes: safeAttributes,
      normalizedAt,
    });

    return { ok: true, entity, actions };
  }

  /**
   * Normalize a raw HA device registry entry into a canonical device record.
   * Entity IDs that belong to the device must be provided by the caller
   * (derived from the HA entity registry, not the device registry entry itself).
   */
  normalizeDevice(
    raw: RawHomeAssistantDevice,
    entityIds: ReadonlyArray<`ha:entity:${string}`>,
    normalizedAt: string = new Date().toISOString(),
  ): CanonicalHomeAssistantDevice {
    return Object.freeze({
      deviceId: `ha:device:${raw.id}` as `ha:device:${string}`,
      sourceDeviceId: raw.id,
      name: raw.name,
      manufacturer: raw.manufacturer ?? undefined,
      model: raw.model ?? undefined,
      entityIds,
      normalizedAt,
    });
  }
}
