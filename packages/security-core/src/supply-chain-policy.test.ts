import { describe, expect, it } from 'vitest';
import { DEFAULT_SUPPLY_CHAIN_POLICY, evaluateDependency } from './supply-chain-policy.js';

const safe = {
  name: 'example', version: '1.0.0', integrity: 'sha512-example', source: 'registry' as const,
  lifecycleScripts: [], provenanceVerified: true,
};

describe('supply chain policy', () => {
  it('approves verified registry dependencies', () => expect(evaluateDependency(safe, DEFAULT_SUPPLY_CHAIN_POLICY).trust).toBe('approved'));
  it('blocks dependencies without integrity', () => expect(evaluateDependency({ ...safe, integrity: undefined }, DEFAULT_SUPPLY_CHAIN_POLICY).trust).toBe('blocked'));
  it('blocks unverified provenance', () => expect(evaluateDependency({ ...safe, provenanceVerified: false }, DEFAULT_SUPPLY_CHAIN_POLICY).trust).toBe('blocked'));
  it('blocks lifecycle scripts by default', () => expect(evaluateDependency({ ...safe, lifecycleScripts: ['postinstall'] }, DEFAULT_SUPPLY_CHAIN_POLICY).trust).toBe('blocked'));
  it('blocks unapproved dependency sources', () => expect(evaluateDependency({ ...safe, source: 'url' }, DEFAULT_SUPPLY_CHAIN_POLICY).trust).toBe('blocked'));
});
