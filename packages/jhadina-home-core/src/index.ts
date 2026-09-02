/**
 * @jhadina/home-core — B&W-6.1 + B&W-6.2 Home Assistant integration boundary.
 *
 * B&W-6.1: canonical entity/device identity, adapter, service mapping, capability registration.
 * B&W-6.2: state/event ingestion pipeline — validate → provenance → idempotency → order → normalize → publish.
 */

export type {
  CanonicalHomeAssistantEntity,
  CanonicalHomeAssistantDevice,
  HomeAssistantEntityDomain,
  HomeAssistantAvailability,
  HomeAssistantTransportConfig,
} from './ha-entity.js';

export {
  HA_DOMAIN_ACTION_MAP,
  resolveHaServiceCall,
  supportedActionsForDomain,
} from './ha-service-map.js';
export type { HaServiceCall, DomainActionMap } from './ha-service-map.js';

export {
  DeterministicHomeAssistantAdapter,
} from './ha-adapter.js';
export type {
  RawHomeAssistantState,
  RawHomeAssistantDevice,
  NormalizationResult,
} from './ha-adapter.js';

export {
  registerHomeAssistantCapabilities,
} from './ha-capability-registrar.js';
export type {
  CapabilityDefinition,
  CapabilityRegistryPort,
} from './ha-capability-registrar.js';

// B&W-6.2 — State/Event Ingestion

export {
  validateHaEvent,
  HA_INGESTION_SCHEMA_VERSION,
} from './ha-event-envelope.js';
export type {
  RawHomeAssistantEvent,
  HaEventEnvelope,
  ValidationResult,
} from './ha-event-envelope.js';

export {
  InMemoryIdempotencyStore,
} from './ha-idempotency.js';
export type { IdempotencyStore } from './ha-idempotency.js';

export {
  determineOrdering,
  InMemoryEntityStateStore,
} from './ha-state-machine.js';
export type {
  HomeEntityState,
  OrderingDecision,
  EntityStateStore,
} from './ha-state-machine.js';

export {
  HomeAssistantIngestionPipeline,
  HA_STATE_CHANGED_EVENT_TYPE,
  HA_STATE_CHANGED_EVENT_VERSION,
} from './ha-ingestion.js';
export type {
  HaEntityStatePayload,
  IngestionResult,
  EventBusPort,
} from './ha-ingestion.js';
