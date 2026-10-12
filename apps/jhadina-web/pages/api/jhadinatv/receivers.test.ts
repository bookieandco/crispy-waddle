import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyJtvReceiverToken } from '../../../lib/jhadinatv/receiver-capability';

const mocks = vi.hoisted(() => ({ owner: vi.fn() }));
vi.mock('../../../lib/jhadinatv/server-viewer', () => ({ requireJtvOwner: mocks.owner }));
import handler from './receivers';

const secret = 'receiver-signing-secret-at-least-32-private-characters';
function request(): NextApiRequest {
  return { method: 'GET', query: {} } as unknown as NextApiRequest;
}
function response(): any {
  return { statusCode: 200, setHeader: vi.fn(),
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; },
  };
}
describe('Owner-only and fail-closed receiver discovery', () => {
  beforeEach(() => {
    mocks.owner.mockResolvedValue('jhadina-owner');
    process.env.JHADINA_TV_RECEIVER_PAIRING_VERIFIED = 'false';
    process.env.JHADINA_TV_RECEIVER_SIGNING_SECRET = secret;
    process.env.JHADINA_TV_RECEIVER_APPROVED_IDS = 'living-room';
    process.env.JHADINA_TV_RECEIVERS = JSON.stringify([
      { id: 'living-room', name: 'Living Room', url: 'wss://trusted.example.test/ws' },
      { id: 'not-approved', name: 'Unapproved', url: 'wss://unknown.example.test/ws' },
      { id: 'living-room', name: 'Insecure', url: 'ws://lan.example.test/ws' },
    ]);
  });
  afterEach(() => {
    for (const key of ['JHADINA_TV_RECEIVER_PAIRING_VERIFIED', 'JHADINA_TV_RECEIVER_SIGNING_SECRET',
      'JHADINA_TV_RECEIVER_APPROVED_IDS', 'JHADINA_TV_RECEIVERS']) delete process.env[key];
    vi.clearAllMocks();
  });
  it('returns no devices while physical pairing proof is absent', async () => {
    const res = response();
    await handler(request(), res as NextApiResponse);
    expect(res.body).toEqual([]);
  });
  it('requires a verified owner before reading devices', async () => {
    mocks.owner.mockImplementation(async (_req: unknown, res: any) => { res.status(403).json({ error: 'denied' }); return null; });
    const res = response();
    await handler(request(), res as NextApiResponse);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'denied' });
  });
  it('only returns signed, allowlisted WSS devices after explicit commissioning', async () => {
    process.env.JHADINA_TV_RECEIVER_PAIRING_VERIFIED = 'true';
    const res = response();
    await handler(request(), res as NextApiResponse);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    const [receiver] = res.body;
    expect(receiver.id).toBe('living-room');
    expect(receiver.url).toBe('wss://trusted.example.test/ws');
    expect(verifyJtvReceiverToken(receiver.authToken, secret, receiver.id)).toBe('jhadina-owner');
  });
  it('does not issue device tokens without a strong signing key', async () => {
    process.env.JHADINA_TV_RECEIVER_PAIRING_VERIFIED = 'true';
    process.env.JHADINA_TV_RECEIVER_SIGNING_SECRET = 'short';
    const res = response();
    await handler(request(), res as NextApiResponse);
    expect(res.statusCode).toBe(503);
  });
});
