import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
const mock = vi.hoisted(() => ({ owner: vi.fn(), title: vi.fn() }));
vi.mock('../../../lib/jhadinatv/server-viewer', () => ({ requireJtvOwner: mock.owner }));
vi.mock('../../../lib/jhadinatv/jellyfin-provider', () => ({ getAuthorizedJellyfinTitle: mock.title }));
import handler from './title';
const req = (id: unknown, kind: unknown, method = 'GET') =>
  ({ method, query: { id, kind } }) as unknown as NextApiRequest;
const res = () => ({ statusCode: 200, setHeader: vi.fn(),
  status(code: number) { this.statusCode = code; return this; },
  json(body: unknown) { this.body = body; return this; },
  body: undefined as unknown }) as unknown as NextApiResponse & { statusCode: number; body: unknown };

describe('JTV exact-item owner lookup', () => {
  beforeEach(() => { vi.clearAllMocks(); mock.owner.mockResolvedValue('owner'); mock.title.mockResolvedValue(null); });
  it('fails closed before provider lookup for non-owner sessions', async () => {
    mock.owner.mockImplementation(async (_req: unknown, response: NextApiResponse) => { response.status(403).json({ error: 'not owner' }); return null; });
    const output = res(); await handler(req('jellyfin:123', 'movie'), output);
    expect(output.statusCode).toBe(403); expect(mock.title).not.toHaveBeenCalled();
  });
  it('rejects malformed IDs and wrong methods', async () => {
    let output = res(); await handler(req('../../etc', 'movie'), output);
    expect(output.statusCode).toBe(400); expect(mock.title).not.toHaveBeenCalled();
    output = res(); await handler(req('jellyfin:1', 'movie', 'POST'), output);
    expect(output.statusCode).toBe(405);
  });
  it('resolves one exact media identity and rejects absent items', async () => {
    mock.title.mockResolvedValueOnce({ id: 'jellyfin:123', kind: 'movie', providerId: 'jellyfin' });
    let output = res(); await handler(req('jellyfin:123', 'movie'), output);
    expect(output.statusCode).toBe(200);
    expect(mock.title).toHaveBeenCalledWith('jellyfin:123', 'movie');
    output = res(); await handler(req('jellyfin:missing', 'movie'), output);
    expect(output.statusCode).toBe(404);
  });
});
