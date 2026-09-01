/**
 * @jhadina/home-core — B&W-6.1 Home Assistant integration boundary.
 *
 * Public API for the canonical Home Automation Fabric.
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
