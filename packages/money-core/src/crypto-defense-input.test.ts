import { describe, expect, it } from 'vitest';
import { decodeCryptoTransactionInput } from './crypto-defense-input.js';

describe('crypto transaction input decoder', () => {
  it('extracts and recognizes a critical selector', () => {
    const result = decodeCryptoTransactionInput('0xbaa2abde00000000');
    expect(result.selector).toBe('0xbaa2abde');
    expect(result.recognized).toBe(true);
    expect(result.risk).toBe('critical');
  });

  it('flags unknown selectors for monitoring', () => {
    const result = decodeCryptoTransactionInput('0x1234567800000000');
    expect(result.selector).toBe('0x12345678');
    expect(result.recognized).toBe(false);
    expect(result.risk).toBe('watch');
  });

  it('handles value transfers with no calldata', () => {
    expect(decodeCryptoTransactionInput('0x')).toEqual({ selector: null, risk: 'info', recognized: false });
  });
});
