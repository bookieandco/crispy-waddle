/**
 * B&W-6.2 — Home Assistant Raw Event Envelope and Provenance
 *
 * Every event entering the ingestion pipeline must carry enough information to
 * establish identity, provenance, and ordering before normalization.
 *
 * Architecture contract:
 * - RawHomeAssistantEvent wraps raw HA webhook/SSE data with metadata the
 *   transport layer adds (receivedAt, transportEventId).
 * - HA-sourced events must remain explicitly attributable to Home Assistant.
 * - No transport secrets (baseUrl, token) appear here — only source identity.
 */

/**
 * Raw Home Assistant event as received from the HA webhook / SSE stream,
 * augmented with transport-layer metadata added by the ingestion boundary.
 *
 * This is the INPUT to the pipeline — it is not stored or published downstream.
 */
export interface RawHomeAssistantEvent {
  /**
   * Transport-level event ID supplied by HA (e.g. from the event stream).
   * May be absent for webhook deliveries; the pipeline derives a deterministic
   * deduplication key when this is missing.
   */
  readonly transportEventId?: string;

  /**
   * HA event type, e.g. "state_changed", "call_service".
   * Required: missing event type is a validation failure.
   */
  readonly eventType: string;

  /**
   * HA event data object — contains entity_id, new_state, old_state, etc.
   * Required: absence is a validation failure.
   */
  readonly data: Readonly<Record<string, unknown>>;

  /**
   * HA origin, e.g. "LOCAL" or "REMOTE".
   * Preserved as provenance metadata.
   */
  readonly origin?: string;

  /**
   * ISO 8601 timestamp of when HA fired the event (from the HA event stream).
   * Used for ordering. Missing timestamps are treated as the received timestamp
   * with an explicit 'timestamp-missing' flag.
   */
  readonly timeFired?: string;

  /**
   * ISO 8601 timestamp of when the ingestion boundary received this event.
   * Set by the transport layer before handing off to the pipeline.
   * Required for ordering fallback when timeFired is absent.
   */
  readonly receivedAt: string;

  /**
   * HA context object — carries HA's own correlation/causation identifiers.
   */
  readonly context?: {
    readonly id?: string;
    readonly parent_id?: string | null;
    readonly user_id?: string | null;
  };
}

/**
 * Validated and enriched event envelope — produced by the validation stage,
 * carried through the pipeline but never published downstream directly.
 * The EventBus receives a DomainEvent<HaEntityStatePayload> instead.
 *
 * B&W-6.2 provenance contract:
 * - provider always = 'home-assistant'
 * - sourceEntityId is the raw HA entity_id
 * - sourceEventId is the deterministic deduplication key
 * - timestamps are preserved exactly as received
 * - correlationId / causationId are propagated from HA context where available
 */
export interface HaEventEnvelope {
  /**
   * Deterministic deduplication key.
   * Derived from transportEventId when present, otherwise from
   * `${entityId}@${timeFired ?? receivedAt}` — documented explicitly.
   */
  readonly eventId: string;

  /** Always 'home-assistant' — prevents HA events masquerading as Jhadina-native events. */
  readonly provider: 'home-assistant';

  /** HA event type (e.g. 'state_changed'). */
  readonly eventType: string;

  /** Schema version of this envelope (for future HA API changes). */
  readonly schemaVersion: number;

  /** Raw HA entity_id from event data. */
  readonly sourceEntityId: string;

  /** ISO 8601 timestamp from HA (timeFired). May be the receivedAt fallback. */
  readonly eventOccurredAt: string;

  /** True when timeFired was absent and receivedAt was substituted. */
  readonly timestampMissing: boolean;

  /** ISO 8601 timestamp when the ingestion boundary received this event. */
  readonly receivedAt: string;

  /** HA origin (LOCAL / REMOTE). */
  readonly origin?: string;

  /** HA context.id → used as correlationId. */
  readonly correlationId?: string;

  /** HA context.parent_id → used as causationId. */
  readonly causationId?: string;

  /** Preserved raw new_state from HA event data. */
  readonly newState: Readonly<Record<string, unknown>> | null;

  /** Preserved raw old_state from HA event data. */
  readonly oldState: Readonly<Record<string, unknown>> | null;
}

/**
 * Validation result for a raw HA event.
 */
export type ValidationResult =
  | { ok: true; envelope: HaEventEnvelope }
  | { ok: false; reason: string; rawEvent: RawHomeAssistantEvent };

/**
 * B&W-6.2 SCHEMA_VERSION for state_changed events.
 * Bump when the envelope contract changes.
 */
export const HA_INGESTION_SCHEMA_VERSION = 1;

/**
 * Validate a raw HA event and produce a fully-provenance-enriched envelope.
 *
 * Validation rules:
 * - eventType must be a non-empty string
 * - data must be a non-null object
 * - entity_id in new_state or old_state must be a non-empty string
 * - Only 'state_changed' events are currently ingested; others are rejected
 *   explicitly (not silently discarded) so the rejection is auditable.
 *
 * Deterministic eventId derivation:
 * - If transportEventId is present: use it.
 * - Otherwise: derive from `ha:state:${entityId}:${timeFired ?? receivedAt}`
 *   This is documented as the canonical fallback.
 */
export function validateHaEvent(raw: RawHomeAssistantEvent): ValidationResult {
  if (!raw.eventType || typeof raw.eventType !== 'string') {
    return { ok: false, reason: 'eventType is missing or not a string', rawEvent: raw };
  }

  if (!raw.data || typeof raw.data !== 'object' || Array.isArray(raw.data)) {
    return { ok: false, reason: 'event data is missing or not an object', rawEvent: raw };
  }

  if (raw.eventType !== 'state_changed') {
    return {
      ok: false,
      reason: `Unsupported event type '${raw.eventType}' — only state_changed is currently ingested`,
      rawEvent: raw,
    };
  }

  // Extract entity_id from new_state or old_state (HA always provides one of them)
  const newState = (raw.data['new_state'] as Record<string, unknown> | null) ?? null;
  const oldState = (raw.data['old_state'] as Record<string, unknown> | null) ?? null;

  const entityId =
    (typeof newState?.['entity_id'] === 'string' ? newState['entity_id'] : null) ??
    (typeof oldState?.['entity_id'] === 'string' ? oldState['entity_id'] : null);

  if (!entityId || typeof entityId !== 'string' || !entityId.trim()) {
    return {
      ok: false,
      reason: 'entity_id is missing from both new_state and old_state',
      rawEvent: raw,
    };
  }

  const timestampMissing = !raw.timeFired;
  const eventOccurredAt = raw.timeFired ?? raw.receivedAt;

  const eventId =
    raw.transportEventId ??
    `ha:state:${entityId}:${eventOccurredAt}`;

  const envelope: HaEventEnvelope = Object.freeze({
    eventId,
    provider: 'home-assistant',
    eventType: raw.eventType,
    schemaVersion: HA_INGESTION_SCHEMA_VERSION,
    sourceEntityId: entityId,
    eventOccurredAt,
    timestampMissing,
    receivedAt: raw.receivedAt,
    origin: raw.origin,
    correlationId: raw.context?.id,
    causationId: raw.context?.parent_id ?? undefined,
    newState: newState ? Object.freeze({ ...newState }) : null,
    oldState: oldState ? Object.freeze({ ...oldState }) : null,
  });

  return { ok: true, envelope };
}
