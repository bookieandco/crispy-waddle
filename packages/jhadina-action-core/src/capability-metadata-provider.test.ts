import { describe, expect, it } from 'vitest';
import { CapabilityRegistry } from '../../jhadina-capability-registry/src/index.js';
import type { CapabilityDefinition } from '../../jhadina-capability-registry/src/index.js';
import {
  RegistryCapabilityMetadataProvider,
  requireRegisteredCapability,
} from './capability-metadata-provider.js';

describe('RegistryCapabilityMetadataProvider', () => {
  const definition: CapabilityDefinition = {
    name: 'test.read',
    version: '1.0.0',
    description: 'test capability',
  };

  it('returns registered capability metadata', () => {
    const registry = new CapabilityRegistry();
    registry.register(definition);

    const provider = new RegistryCapabilityMetadataProvider(registry);

    expect(provider.get(definition.name)).toEqual(definition);
  });

  it('returns undefined for unknown capabilities', () => {
    const provider = new RegistryCapabilityMetadataProvider(new CapabilityRegistry());

    expect(provider.get('missing.capability')).toBeUndefined();
  });

  it('fails closed when a requested capability is not registered', () => {
    const provider = new RegistryCapabilityMetadataProvider(new CapabilityRegistry());

    expect(() =>
      requireRegisteredCapability(provider, { type: 'missing.capability' }),
    ).toThrow('Unknown capability: missing.capability');
  });
});
