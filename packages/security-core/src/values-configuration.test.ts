import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  JHADINA_DEFAULT_VALUES_CONFIGURATION,
  assertValidValuesConfiguration,
  InvalidValuesConfigurationError,
  type JhadinaValuesConfiguration,
} from './values-configuration.js';

test('the default configuration is maximally restrictive — zero spend, zero recipients, zero platforms', () => {
  assert.equal(JHADINA_DEFAULT_VALUES_CONFIGURATION.financial.maxAmountMinorPerAction, 0);
  assert.equal(JHADINA_DEFAULT_VALUES_CONFIGURATION.financial.maxAmountMinorPerDay, 0);
  assert.deepEqual(JHADINA_DEFAULT_VALUES_CONFIGURATION.externalCommunication.allowedRecipientDomains, []);
  assert.deepEqual(JHADINA_DEFAULT_VALUES_CONFIGURATION.publishing.allowedPlatforms, []);
});

test('the default configuration itself passes its own validation', () => {
  assert.doesNotThrow(() => assertValidValuesConfiguration(JHADINA_DEFAULT_VALUES_CONFIGURATION));
});

function validConfig(overrides: Partial<JhadinaValuesConfiguration> = {}): JhadinaValuesConfiguration {
  return {
    ...JHADINA_DEFAULT_VALUES_CONFIGURATION,
    updatedBy: 'user_real_human_123',
    ...overrides,
  };
}

test('rejects a configuration claiming to have been updated by the model/system/assistant itself', () => {
  for (const forgedActor of ['jhadina', 'system', 'model', 'assistant', 'ai', 'JHADINA']) {
    assert.throws(
      () => assertValidValuesConfiguration(validConfig({ updatedBy: forgedActor })),
      InvalidValuesConfigurationError,
    );
  }
});

test('rejects an empty updatedBy', () => {
  assert.throws(() => assertValidValuesConfiguration(validConfig({ updatedBy: '' })), InvalidValuesConfigurationError);
});

test('rejects a negative or non-finite financial limit — a malformed policy fails loudly, not silently', () => {
  assert.throws(
    () => assertValidValuesConfiguration(validConfig({ financial: { currency: 'USD', maxAmountMinorPerAction: -1, maxAmountMinorPerDay: 100 } })),
    InvalidValuesConfigurationError,
  );
  assert.throws(
    () => assertValidValuesConfiguration(validConfig({ financial: { currency: 'USD', maxAmountMinorPerAction: NaN, maxAmountMinorPerDay: 100 } })),
    InvalidValuesConfigurationError,
  );
});

test('rejects a per-action limit that exceeds the per-day limit', () => {
  assert.throws(
    () => assertValidValuesConfiguration(validConfig({ financial: { currency: 'USD', maxAmountMinorPerAction: 500, maxAmountMinorPerDay: 100 } })),
    InvalidValuesConfigurationError,
  );
});

test('accepts a real, human-authored, internally-consistent configuration', () => {
  assert.doesNotThrow(() =>
    assertValidValuesConfiguration(
      validConfig({ financial: { currency: 'USD', maxAmountMinorPerAction: 5_000, maxAmountMinorPerDay: 20_000 } }),
    ),
  );
});
