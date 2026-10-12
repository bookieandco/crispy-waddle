import { describe, expect, it } from 'vitest';
import { createJtvStreamCapability, verifyJtvStreamCapability } from './stream-capability';

const secret = 'owner-private-capability-secret-at-least-32-characters';
const scope = {
  ownerId: 'owner-auth-1', assetId: 'asset-23', mode: 'vod' as const,
  audience: 'local' as const, territory: 'US', rightsEvidence: 'rights-proof-fingerprint',
};

describe('JhadinaTV scoped stream capabilities', () => {
  it('verifies an exact owner/asset/mode/audience/territory and evidence binding', () => {
    const token = createJtvStreamCapability(scope, secret, 1_000, 300);
    const claims = verifyJtvStreamCapability(token, secret, 1_100);
    expect(claims).toMatchObject({ ...scope, issuedAt: 1_000, expiresAt: 1_300 });
    expect(claims?.audience).toBe('local');
  });

  it('rejects altered claims and changed signing secrets', () => {
    const token = createJtvStreamCapability(scope, secret, 1_000);
    const [body, signature] = token.split('.');
    const changed = Buffer.from(JSON.stringify({ ...scope, v: 1, issuedAt: 1_000, expiresAt: 4_600, assetId: 'other' })).toString('base64url');
    expect(verifyJtvStreamCapability(`${changed}.${signature}`, secret, 1_010)).toBeNull();
    expect(verifyJtvStreamCapability(token, 'another-password-at-least-32-chars-different', 1_010)).toBeNull();
  });

  it('rejects expiry, future-issued, malformed, and overlong tokens', () => {
    const token = createJtvStreamCapability(scope, secret, 1_000, 20);
    expect(verifyJtvStreamCapability(token, secret, 1_020)).toBeNull();
    expect(verifyJtvStreamCapability(token, secret, 900)).toBeNull();
    expect(verifyJtvStreamCapability('invalid', secret, 1_001)).toBeNull();
    expect(verifyJtvStreamCapability('x'.repeat(2200), secret, 1_001)).toBeNull();
  });

  it('issues cast and local access separately and enforces lifetime limits', () => {
    const cast = createJtvStreamCapability({ ...scope, audience: 'cast' }, secret, 1_000, 120);
    expect(verifyJtvStreamCapability(cast, secret, 1_010)?.audience).toBe('cast');
    expect(() => createJtvStreamCapability(scope, secret, 1_000, 14_401)).toThrow();
    expect(() => createJtvStreamCapability(scope, 'short', 1_000)).toThrow();
  });
});
