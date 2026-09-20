import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModelRegistry } from './model-registry.js';

const base = {
  id: 'm1', provider: 'p', providerModelId: 'model',
  modalities: ['text'] as const, capabilities: ['reason'] as const,
  maxPrivacyClass: 'sensitive' as const, contextWindowTokens: 1000,
  maxOutputTokens: 100, costClass: 'low' as const, latencyClass: 'fast' as const,
  lifecycle: 'active' as const, local: false, version: 1,
};

test('registry rejects duplicate canonical model ids', () => {
  assert.throws(() => new ModelRegistry({ version: 1, models: [base, base] }), /MODEL_REGISTRY_DUPLICATE_ID/);
});

test('eligible enforces capability, modality, privacy, lifecycle and context', () => {
  const registry = new ModelRegistry({ version: 1, models: [
    base,
    { ...base, id: 'disabled', lifecycle: 'disabled' },
    { ...base, id: 'public-only', maxPrivacyClass: 'public' },
  ]});
  assert.deepEqual(
    registry.eligible({ modalities: ['text'], capabilities: ['reason'], privacyClass: 'internal', minimumContextWindowTokens: 500 }).map(m => m.id),
    ['m1'],
  );
  assert.equal(registry.eligible({ modalities: ['vision'], capabilities: ['reason'], privacyClass: 'internal' }).length, 0);
  assert.equal(registry.eligible({ modalities: ['text'], capabilities: ['research'], privacyClass: 'internal' }).length, 0);
  assert.equal(registry.eligible({ modalities: ['text'], capabilities: ['reason'], privacyClass: 'restricted' }).length, 0);
  assert.equal(registry.eligible({ modalities: ['text'], capabilities: ['reason'], privacyClass: 'internal', minimumContextWindowTokens: 2000 }).length, 0);
});

test('require fails closed for an unregistered model', () => {
  const registry = new ModelRegistry({ version: 1, models: [base] });
  assert.throws(() => registry.require('missing'), /MODEL_REGISTRY_UNKNOWN_MODEL/);
});
