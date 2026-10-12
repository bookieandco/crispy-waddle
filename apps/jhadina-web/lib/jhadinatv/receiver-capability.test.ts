import { describe, expect, it } from 'vitest';
import { createJtvReceiverToken, verifyJtvReceiverToken } from './receiver-capability';

const secret = 'authentic-receiver-secret-with-at-least-32-characters';

describe('TV receiver pairing capability', () => {
  it('is receiver-specific, owner-scoped, and time-limited', () => {
    const token = createJtvReceiverToken('owner-1', 'living-room', secret, 1_000);
    expect(verifyJtvReceiverToken(token, secret, 'living-room', 1_030)).toBe('owner-1');
    expect(verifyJtvReceiverToken(token, secret, 'bedroom', 1_030)).toBeNull();
    expect(verifyJtvReceiverToken(token, secret, 'living-room', 1_060)).toBeNull();
  });

  it('rejects a tampered token and noncommissioned secret', () => {
    const token = createJtvReceiverToken('owner-1', 'living-room', secret, 1_000);
    const [body] = token.split('.');
    expect(verifyJtvReceiverToken(`${body}.AAAAAAAA`, secret, 'living-room', 1_001)).toBeNull();
    expect(() => createJtvReceiverToken('owner-1', 'living-room', 'short')).toThrow();
  });
});
