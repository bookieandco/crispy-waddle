import { describe, expect, it } from 'vitest';
import { ephemeralSecret } from './secret-lifecycle.js';

describe('ephemeralSecret', () => {
  it('allows access before disposal', () => {
    const secret = ephemeralSecret('credential-material');
    expect(secret.value).toBe('credential-material');
    expect(secret.disposed).toBe(false);
  });

  it('rejects access after disposal', () => {
    const secret = ephemeralSecret('credential-material');
    secret.dispose();
    expect(secret.disposed).toBe(true);
    expect(() => secret.value).toThrow('Secret has been disposed');
  });
});
