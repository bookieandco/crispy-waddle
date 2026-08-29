import { describe, expect, it } from 'vitest';
import { evaluateTokenSecurity } from './crypto-defense-model.js';

describe('crypto pre-trade defense', () => {
  it('allows a clean paper-trade candidate', () => {
    const result = evaluateTokenSecurity({ token: '0xtoken', chain: 'ethereum', liquidityLocks: [] });
    expect(result.allowed).toBe(true);
    expect(result.threat).toBe('clear');
  });

  it('blocks a failed simulated sell', () => {
    const result = evaluateTokenSecurity(
      { token: '0xtoken', chain: 'ethereum', liquidityLocks: [] },
      { mode: 'fork', buySucceeded: true, sellSucceeded: false, revertReason: 'transfer restricted' },
    );
    expect(result.allowed).toBe(false);
    expect(result.threat).toBe('critical');
  });

  it('blocks extreme sell tax', () => {
    const result = evaluateTokenSecurity({ token: '0xtoken', chain: 'ethereum', sellTaxBps: 10000, liquidityLocks: [] });
    expect(result.allowed).toBe(false);
    expect(result.threat).toBe('critical');
  });
});
