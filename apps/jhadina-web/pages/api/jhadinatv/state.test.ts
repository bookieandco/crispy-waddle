import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
const mock = vi.hoisted(() => ({ owner: vi.fn(), client: vi.fn(), rpc: vi.fn(),
  checkpoint: vi.fn(), watchlisted: vi.fn() }));
vi.mock('../../../lib/jhadinatv/server-viewer', () => ({
  requireJtvOwner: mock.owner, createJtvOwnerClient: mock.client,
}));
import handler from './state';
function request(method: string, query: Record<string, unknown> = {}, body: unknown = {}) {
  return { method, query, body, cookies: {},
    headers: { origin: 'https://tv.test', host: 'tv.test', 'content-type': 'application/json' } } as unknown as NextApiRequest;
}
function response() {
  return { statusCode: 200, setHeader: vi.fn(), getHeader: vi.fn(),
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; },
    body: null as unknown,
  } as unknown as NextApiResponse & { statusCode: number; body: any };
}
describe('owner-only JTV operational state API', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.owner.mockResolvedValue('owner');
    mock.rpc.mockResolvedValue({ error: null });
    mock.client.mockReturnValue({ rpc: mock.rpc });
  });
  it('denies non-owner without opening database', async () => {
    mock.owner.mockImplementation(async (_req: unknown, res: NextApiResponse) => {
      res.status(403).json({ error: 'not owner' }); return null;
    });
    const res = response(); await handler(request('GET'), res);
    expect(res.statusCode).toBe(403); expect(mock.client).not.toHaveBeenCalled();
  });
  it('denies cross-origin writes even for a logged-in owner', async () => {
    const req = request('POST', {}, { action: 'checkpoint', mediaId: 'jellyfin:abc' });
    req.headers.origin = 'https://attacker.test';
    const res = response(); await handler(req, res);
    expect(res.statusCode).toBe(403); expect(mock.owner).not.toHaveBeenCalled();
  });
  it('accepts only canonical media IDs and numeric checkpoints', async () => {
    const res = response();
    await handler(request('POST', {}, { action: 'checkpoint', mediaId: 'http://evil.test', positionSeconds: 3 }), res);
    expect(res.statusCode).toBe(400); expect(mock.rpc).not.toHaveBeenCalled();
    const res2 = response();
    await handler(request('POST', {}, { action: 'checkpoint', mediaId: 'jellyfin:abc', positionSeconds: Number.NaN }), res2);
    expect(res2.statusCode).toBe(400);
  });
  it('writes owner scope through the monotonic checkpoint RPC only', async () => {
    const res = response(); const observedAt = new Date().toISOString();
    await handler(request('POST', {}, { action: 'checkpoint', mediaId: 'jellyfin:abc',
      positionSeconds: 12, durationSeconds: 90, observedAt }), res);
    expect(res.statusCode).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith('jtv_record_checkpoint', {
      p_media_id: 'jellyfin:abc', p_position_seconds: 12, p_duration_seconds: 90, p_observed_at: observedAt,
    });
  });
  it('does not pretend missing database schema is commissioned', async () => {
    mock.rpc.mockResolvedValue({ error: { message: 'table missing' } });
    const res = response();
    await handler(request('POST', {}, { action: 'checkpoint', mediaId: 'jellyfin:abc',
      positionSeconds: 12, observedAt: new Date().toISOString() }), res);
    expect(res.statusCode).toBe(503);
  });
});
