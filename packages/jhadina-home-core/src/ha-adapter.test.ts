/**
 * B&W-6.1 Home Automation contract tests.
 *
 * Each test group maps to one Issue #200 repair finding:
 *
 * FINDING 1 — No baseUrl / credentials in canonical entity or device records
 * FINDING 2 — Deterministic domain→service/action mapping; no remote.power hardcode
 * FINDING 3 — Transport constructor shape is explicit and testable without ad-hoc config
 * FINDING 4 — HA capabilities register through the existing CapabilityRegistry
 *
 * Tests use the Node built-in test runner (tsx --test) — no pnpm required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DeterministicHomeAssistantAdapter } from './ha-adapter.js';
import {
  resolveHaServiceCall,
  supportedActionsForDomain,
  HA_DOMAIN_ACTION_MAP,
} from './ha-service-map.js';
import { registerHomeAssistantCapabilities } from './ha-capability-registrar.js';
import type {
  CanonicalHomeAssistantEntity,
  HomeAssistantTransportConfig,
} from './ha-entity.js';
import type { CapabilityRegistryPort } from './ha-capability-registrar.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const FIXED_TIME = '2026-09-01T00:00:00.000Z';

const adapter = new DeterministicHomeAssistantAdapter();

function makeRegistry(): CapabilityRegistryPort & { registered: Map<string, unknown> } {
  const registered = new Map<string, unknown>();
  return {
    registered,
    register(def) {
      if (registered.has(def.name)) throw new Error(`Duplicate: ${def.name}`);
      registered.set(def.name, def);
    },
    has(name) { return registered.has(name); },
  };
}

// ---------------------------------------------------------------------------
// FINDING 1 — Canonical records must NOT contain baseUrl or credentials
// ---------------------------------------------------------------------------

describe('FINDING 1: canonical entity records contain no transport secrets', () => {
  it('CanonicalHomeAssistantEntity has no baseUrl field', () => {
    const result = adapter.normalizeEntity(
      { entity_id: 'light.living_room', state: 'on', attributes: { friendly_name: 'Living Room' } },
      FIXED_TIME,
    );
    assert.ok(result.ok);
    // TypeScript structural check at runtime
    assert.ok(!('baseUrl' in result.entity), 'entity must not have baseUrl');
    assert.ok(!('accessToken' in result.entity), 'entity must not have accessToken');
    assert.ok(!('token' in result.entity), 'entity must not have token');
    assert.ok(!('url' in result.entity), 'entity must not have url');
    assert.ok(!('host' in result.entity), 'entity must not have host');
  });

  it('CanonicalHomeAssistantDevice has no baseUrl field', () => {
    const device = adapter.normalizeDevice(
      { id: 'abc123', name: 'Living Room Hub', manufacturer: 'Philips', model: 'Hue Bridge' },
      ['ha:entity:light.living_room'],
      FIXED_TIME,
    );
    assert.ok(!('baseUrl' in device), 'device must not have baseUrl');
    assert.ok(!('accessToken' in device), 'device must not have accessToken');
    assert.ok(!('token' in device), 'device must not have token');
  });

  it('canonical entity attributes allowlist excludes transport-secret-shaped keys', () => {
    const result = adapter.normalizeEntity(
      {
        entity_id: 'light.living_room',
        state: 'on',
        attributes: {
          friendly_name: 'Living Room',
          // Poison attributes that must NOT appear in canonical record
          base_url: 'http://homeassistant.local:8123',
          access_token: 'secret-long-lived-token',
          webhook_id: 'internal-ha-webhook-id',
          _entry_id: 'config-entry-id',
          // Safe attributes that SHOULD appear
          brightness: 128,
        },
      },
      FIXED_TIME,
    );
    assert.ok(result.ok);
    const attrs = result.entity.attributes;
    assert.ok(!('base_url' in attrs), 'base_url must be excluded from attributes');
    assert.ok(!('access_token' in attrs), 'access_token must be excluded');
    assert.ok(!('webhook_id' in attrs), 'webhook_id must be excluded');
    assert.ok(!('_entry_id' in attrs), '_entry_id must be excluded');
    assert.equal(attrs['brightness'], 128, 'safe attribute brightness should be present');
  });

  it('HomeAssistantTransportConfig is a separate type not part of entity/device', () => {
    // Structural regression: transport config must be constructible separately
    const transportConfig: HomeAssistantTransportConfig = {
      baseUrl: 'http://homeassistant.local:8123',
      accessToken: 'long-lived-token',
    };
    assert.equal(transportConfig.baseUrl, 'http://homeassistant.local:8123');
    assert.equal(transportConfig.accessToken, 'long-lived-token');

    // Confirm its fields do not appear on a canonical entity
    const result = adapter.normalizeEntity(
      { entity_id: 'switch.garage_door', state: 'off', attributes: {} },
      FIXED_TIME,
    );
    assert.ok(result.ok);
    const entity: CanonicalHomeAssistantEntity = result.entity;
    assert.ok(!Object.keys(entity).includes('baseUrl'));
    assert.ok(!Object.keys(entity).includes('accessToken'));
  });

  it('normalizedAt is an ISO 8601 string for deterministic timestamp injection', () => {
    const result = adapter.normalizeEntity(
      { entity_id: 'switch.porch_light', state: 'on', attributes: {} },
      FIXED_TIME,
    );
    assert.ok(result.ok);
    assert.equal(result.entity.normalizedAt, FIXED_TIME);
  });
});

// ---------------------------------------------------------------------------
// FINDING 2 — Deterministic service/action mapping; no remote.power hardcode
// ---------------------------------------------------------------------------

describe('FINDING 2: deterministic domain→service/action mapping', () => {
  it('remote domain has no ad-hoc remote.power action', () => {
    const remoteActions = supportedActionsForDomain('remote');
    assert.ok(!remoteActions.includes('remote.power'), 'remote.power must not exist — it was an ad-hoc alias');
  });

  it('remote domain has explicit turn_on, turn_off, and toggle actions', () => {
    const remoteActions = supportedActionsForDomain('remote');
    assert.ok(remoteActions.includes('remote.turn_on'), 'remote.turn_on must exist');
    assert.ok(remoteActions.includes('remote.turn_off'), 'remote.turn_off must exist');
    assert.ok(remoteActions.includes('remote.toggle'), 'remote.toggle must exist');
  });

  it('remote.turn_on maps to remote service (not homeassistant.toggle)', () => {
    const call = resolveHaServiceCall('remote', 'remote.turn_on');
    assert.ok(call, 'remote.turn_on must have a mapping');
    assert.equal(call.domain, 'remote');
    assert.equal(call.service, 'turn_on');
  });

  it('remote.turn_off maps to remote service', () => {
    const call = resolveHaServiceCall('remote', 'remote.turn_off');
    assert.ok(call);
    assert.equal(call.domain, 'remote');
    assert.equal(call.service, 'turn_off');
  });

  it('remote.toggle maps to homeassistant.toggle — the HA-native stateless toggle', () => {
    const call = resolveHaServiceCall('remote', 'remote.toggle');
    assert.ok(call);
    assert.equal(call.domain, 'homeassistant');
    assert.equal(call.service, 'toggle');
  });

  it('resolveHaServiceCall returns undefined for unknown action — explicit failure', () => {
    const call = resolveHaServiceCall('remote', 'remote.power');
    assert.equal(call, undefined, 'resolveHaServiceCall must return undefined for removed ad-hoc action');
  });

  it('resolveHaServiceCall returns undefined for unsupported domain', () => {
    const call = resolveHaServiceCall('unsupported_domain', 'some.action');
    assert.equal(call, undefined);
  });

  it('sensor domain has no actions — read-only domain', () => {
    const actions = supportedActionsForDomain('sensor');
    assert.equal(actions.length, 0, 'sensor is read-only — no service calls');
  });

  it('binary_sensor domain has no actions — read-only domain', () => {
    const actions = supportedActionsForDomain('binary_sensor');
    assert.equal(actions.length, 0);
  });

  it('light domain has turn_on, turn_off, toggle, set_brightness', () => {
    const actions = supportedActionsForDomain('light');
    assert.ok(actions.includes('light.turn_on'));
    assert.ok(actions.includes('light.turn_off'));
    assert.ok(actions.includes('light.toggle'));
    assert.ok(actions.includes('light.set_brightness'));
  });

  it('lock domain has lock and unlock — no toggle ambiguity', () => {
    const actions = supportedActionsForDomain('lock');
    assert.ok(actions.includes('lock.lock'));
    assert.ok(actions.includes('lock.unlock'));
    assert.ok(!actions.includes('lock.toggle'), 'locks must not have a toggle — explicit lock/unlock only');
  });

  it('every domain action in the table resolves to a concrete HA service call', () => {
    // Regression: no action in the map should resolve to undefined
    for (const [domain, actionMap] of Object.entries(HA_DOMAIN_ACTION_MAP)) {
      for (const action of Object.keys(actionMap)) {
        const call = resolveHaServiceCall(domain, action);
        assert.ok(call, `${domain}:${action} must resolve to a service call`);
        assert.ok(typeof call.domain === 'string' && call.domain.length > 0, `${action} must have domain`);
        assert.ok(typeof call.service === 'string' && call.service.length > 0, `${action} must have service`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// FINDING 3 — Transport constructor shape is explicit; tests use correct shape
// ---------------------------------------------------------------------------

describe('FINDING 3: transport config is explicit and tested with correct shape', () => {
  it('HomeAssistantTransportConfig requires both baseUrl and accessToken — no partial construction', () => {
    // TypeScript enforces this at compile time; this test verifies the runtime shape
    // a future test author cannot accidentally omit accessToken or baseUrl.
    const config: HomeAssistantTransportConfig = {
      baseUrl: 'http://homeassistant.local:8123',
      accessToken: 'eyJhbGci...test-token',
    };
    assert.equal(typeof config.baseUrl, 'string');
    assert.equal(typeof config.accessToken, 'string');
    assert.ok(config.baseUrl.startsWith('http'), 'baseUrl must be an HTTP URL');
  });

  it('adapter normalizeEntity does NOT require transport config — purely entity-scoped', () => {
    // The adapter constructor takes no transport config; this is the regression
    // proof that transport state cannot leak into entity normalization.
    const adapterInstance = new DeterministicHomeAssistantAdapter();
    // Constructor accepts zero arguments — no transport config shape required
    const result = adapterInstance.normalizeEntity(
      { entity_id: 'climate.bedroom', state: 'heat', attributes: { current_temperature: 21 } },
      FIXED_TIME,
    );
    assert.ok(result.ok);
    assert.equal(result.entity.domain, 'climate');
  });

  it('normalizeEntity with unavailable state preserves availability correctly', () => {
    const result = adapter.normalizeEntity(
      { entity_id: 'light.office', state: 'unavailable', attributes: {} },
      FIXED_TIME,
    );
    assert.ok(result.ok);
    assert.equal(result.entity.availability, 'unavailable');
  });

  it('normalizeEntity with unknown state preserves availability correctly', () => {
    const result = adapter.normalizeEntity(
      { entity_id: 'switch.outdoor', state: 'unknown', attributes: {} },
      FIXED_TIME,
    );
    assert.ok(result.ok);
    assert.equal(result.entity.availability, 'unknown');
  });

  it('normalizeEntity with missing entity_id fails explicitly', () => {
    const result = adapter.normalizeEntity(
      { entity_id: '', state: 'on', attributes: {} },
      FIXED_TIME,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.reason.length > 0);
  });

  it('normalizeDevice with injected timestamp produces deterministic output', () => {
    const device = adapter.normalizeDevice(
      { id: 'dev1', name: 'TV Remote', manufacturer: 'Sony', model: 'RM-VZ320' },
      ['ha:entity:remote.living_room_tv'],
      FIXED_TIME,
    );
    assert.equal(device.deviceId, 'ha:device:dev1');
    assert.equal(device.sourceDeviceId, 'dev1');
    assert.equal(device.normalizedAt, FIXED_TIME);
    assert.equal(device.manufacturer, 'Sony');
    assert.equal(device.model, 'RM-VZ320');
    assert.ok(!('baseUrl' in device));
  });
});

// ---------------------------------------------------------------------------
// FINDING 4 — HA capabilities register through the existing CapabilityRegistry
// ---------------------------------------------------------------------------

describe('FINDING 4: HA capabilities flow through the existing CapabilityRegistry boundary', () => {
  it('available light entity registers light capabilities through the registry', () => {
    const result = adapter.normalizeEntity(
      { entity_id: 'light.living_room', state: 'on', attributes: { friendly_name: 'Living Room' } },
      FIXED_TIME,
    );
    assert.ok(result.ok);

    const registry = makeRegistry();
    const registered = registerHomeAssistantCapabilities(result.entity, result.actions, registry);

    assert.ok(registered.length > 0, 'should register at least one capability');
    assert.ok(registered.every(name => name.startsWith('ha:entity:light.living_room:')));
    // Verify structure through registry
    const cap = registry.registered.get(registered[0]!) as { risk: string; auditRequired: boolean };
    assert.equal(cap.risk, 'external');
    assert.equal(cap.auditRequired, true);
  });

  it('unavailable entity registers NO capabilities — fail closed', () => {
    const result = adapter.normalizeEntity(
      { entity_id: 'light.offline', state: 'unavailable', attributes: {} },
      FIXED_TIME,
    );
    assert.ok(result.ok);
    const registry = makeRegistry();
    const registered = registerHomeAssistantCapabilities(result.entity, result.actions, registry);
    assert.equal(registered.length, 0, 'unavailable entities must not produce capabilities');
    assert.equal(registry.registered.size, 0);
  });

  it('unknown-availability entity registers NO capabilities', () => {
    const result = adapter.normalizeEntity(
      { entity_id: 'switch.unknown', state: 'unknown', attributes: {} },
      FIXED_TIME,
    );
    assert.ok(result.ok);
    const registry = makeRegistry();
    const registered = registerHomeAssistantCapabilities(result.entity, result.actions, registry);
    assert.equal(registered.length, 0);
  });

  it('sensor entity registers NO capabilities — read-only domain', () => {
    const result = adapter.normalizeEntity(
      { entity_id: 'sensor.temperature', state: '21.5', attributes: { unit_of_measurement: '°C' } },
      FIXED_TIME,
    );
    assert.ok(result.ok);
    const registry = makeRegistry();
    const registered = registerHomeAssistantCapabilities(result.entity, result.actions, registry);
    assert.equal(registered.length, 0, 'sensor has no actions — no capabilities registered');
  });

  it('lock.unlock is registered as destructive risk with approvalRequired', () => {
    const lockEntity: CanonicalHomeAssistantEntity = {
      entityId: 'ha:entity:lock.front_door',
      sourceEntityId: 'lock.front_door',
      domain: 'lock',
      friendlyName: 'Front Door',
      availability: 'available',
      attributes: Object.freeze({}),
      normalizedAt: FIXED_TIME,
    };
    const registry = makeRegistry();
    registerHomeAssistantCapabilities(lockEntity, ['lock.lock', 'lock.unlock'], registry);

    const unlockCap = registry.registered.get('ha:entity:lock.front_door:lock.unlock') as {
      risk: string; approvalRequired: boolean; auditRequired: boolean;
    };
    assert.ok(unlockCap, 'lock.unlock must be registered');
    assert.equal(unlockCap.risk, 'destructive');
    assert.equal(unlockCap.approvalRequired, true);
    assert.equal(unlockCap.auditRequired, true);
  });

  it('registration is idempotent — already-registered capabilities are silently skipped', () => {
    const result = adapter.normalizeEntity(
      { entity_id: 'switch.garage', state: 'off', attributes: {} },
      FIXED_TIME,
    );
    assert.ok(result.ok);
    const registry = makeRegistry();
    const first = registerHomeAssistantCapabilities(result.entity, result.actions, registry);
    const second = registerHomeAssistantCapabilities(result.entity, result.actions, registry);
    assert.ok(first.length > 0);
    assert.equal(second.length, 0, 'second registration of same entity should register nothing new');
    assert.equal(registry.registered.size, first.length, 'registry size must not change on second call');
  });

  it('registration does NOT equal authorization — registry does not grant execution permission', () => {
    // The registry records capabilities; authorization happens in Policy.
    // This test proves that capability name composition is deterministic
    // (enabling Policy to look them up) and that no "granted" flag exists
    // on the registered capability definition.
    const result = adapter.normalizeEntity(
      { entity_id: 'media_player.living_room_tv', state: 'on', attributes: { friendly_name: 'Living Room TV' } },
      FIXED_TIME,
    );
    assert.ok(result.ok);
    const registry = makeRegistry();
    const registered = registerHomeAssistantCapabilities(result.entity, result.actions, registry);
    for (const name of registered) {
      const cap = registry.registered.get(name) as Record<string, unknown>;
      assert.ok(!('authorized' in cap), 'registered capability must not carry an authorized flag');
      assert.ok(!('allowed' in cap), 'registered capability must not carry an allowed flag');
      assert.ok(!('granted' in cap), 'registered capability must not carry a granted flag');
    }
  });

  it('HA capabilities use the executor key ha:executor so Policy/Action core can route to the HA adapter', () => {
    const result = adapter.normalizeEntity(
      { entity_id: 'cover.bedroom_blinds', state: 'open', attributes: {} },
      FIXED_TIME,
    );
    assert.ok(result.ok);
    const registry = makeRegistry();
    const registered = registerHomeAssistantCapabilities(result.entity, result.actions, registry);
    for (const name of registered) {
      const cap = registry.registered.get(name) as { executor: string };
      assert.equal(cap.executor, 'ha:executor', `${name} must route to ha:executor`);
    }
  });
});
