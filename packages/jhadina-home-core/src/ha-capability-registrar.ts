/**
 * HomeAssistantCapabilityRegistrar — B&W-6.1 FINDING 4
 *
 * Registers Home Assistant-derived capabilities into the EXISTING canonical
 * CapabilityRegistry.  This is the only place HA capabilities enter the
 * registry; they flow through the same Policy/authorization boundary as
 * every other Jhadina capability.
 *
 * Architecture contract:
 * - Registration uses the existing CapabilityRegistry — no second registry.
 * - Registration ≠ Authorization (the registry's own invariant).
 * - HA 'write' actions (turn_on, turn_off, etc.) are registered as 'external'
 *   risk so Policy knows they cross a device boundary.
 * - 'lock.unlock' and 'cover.open' are 'destructive' risk (physical security).
 * - Sensor-domain entities produce no capabilities (read-only HA side).
 * - Capabilities are not registered when the entity's availability is
 *   'unavailable' or 'unknown' — an unavailable entity cannot be acted on.
 */

import type { CanonicalHomeAssistantEntity } from './ha-entity.js';

/**
 * Minimal CapabilityDefinition shape required for registration.
 * Matches the contract exported by @jhadina/capability-registry without
 * creating a hard runtime dependency (avoids circular import at package build).
 * The real CapabilityRegistry's register() accepts this shape.
 */
export interface CapabilityDefinition {
  readonly name: string;
  readonly description: string;
  readonly risk: 'read' | 'write' | 'external' | 'financial' | 'destructive';
  readonly version: number;
  readonly approvalRequired?: boolean;
  readonly auditRequired?: boolean;
  readonly executor?: string;
  readonly idempotency?: string;
}

/**
 * Minimal CapabilityRegistry interface — the registrar depends on only the
 * register() and has() methods rather than the entire registry class.
 */
export interface CapabilityRegistryPort {
  register(definition: CapabilityDefinition): void;
  has(name: string): boolean;
}

const DESTRUCTIVE_ACTIONS: ReadonlySet<string> = new Set([
  'lock.unlock',
  'cover.open',
]);

const APPROVAL_REQUIRED_ACTIONS: ReadonlySet<string> = new Set([
  'lock.unlock',
  'lock.lock',
  'cover.open',
  'cover.close',
]);

/**
 * Derive the capability risk level for a given HA action.
 */
function deriveRisk(action: string): CapabilityDefinition['risk'] {
  if (DESTRUCTIVE_ACTIONS.has(action)) return 'destructive';
  return 'external';
}

/**
 * Registers capabilities for a normalized HA entity into the provided
 * CapabilityRegistry.  Each supported Jhadina action for the entity's domain
 * becomes one registered capability.
 *
 * @param entity   - Canonical entity record (no transport secrets)
 * @param actions  - Supported Jhadina action names for the entity's domain
 *                   (from DeterministicHomeAssistantAdapter.normalizeEntity)
 * @param registry - The existing canonical CapabilityRegistry
 * @param version  - Capability version; bump when the action contract changes
 *
 * Returns the list of capability names that were newly registered.
 * Already-registered capabilities are silently skipped (idempotent).
 * Unavailable/unknown entities are skipped entirely — a device that is
 * not reachable should not have executable capabilities registered.
 */
export function registerHomeAssistantCapabilities(
  entity: CanonicalHomeAssistantEntity,
  actions: readonly string[],
  registry: CapabilityRegistryPort,
  version = 1,
): readonly string[] {
  // Finding 4 guard: unavailable entities must not produce capabilities.
  if (entity.availability !== 'available') return [];

  const registered: string[] = [];
  for (const action of actions) {
    // Capability name format: ha:<entityId>:<action>
    // e.g. ha:entity:light.living_room:light.turn_on
    const capabilityName = `${entity.entityId}:${action}`;
    if (registry.has(capabilityName)) continue; // already registered — skip

    registry.register({
      name: capabilityName,
      description: `Home Assistant: ${entity.friendlyName} — ${action}`,
      risk: deriveRisk(action),
      version,
      approvalRequired: APPROVAL_REQUIRED_ACTIONS.has(action),
      auditRequired: true, // all HA executions are audited — external device control
      executor: 'ha:executor',
      idempotency:
        action.endsWith('.toggle')
          ? 'not idempotent — toggles current state'
          : 'idempotent — HA services are safe to retry',
    });
    registered.push(capabilityName);
  }
  return registered;
}
