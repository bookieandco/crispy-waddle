import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
const mock = vi.hoisted(() => ({ owner: vi.fn(), series: vi.fn() }));
vi.mock('../../../lib/jhadinatv/server-viewer', () => ({ requireJtvOwner: mock.owner }));
vi.mock('../../../lib/jhadinatv/jellyfin-provider', () => ({ getAuthorizedJellyfinSeries: mock.series }));
import handler from './series';
const req = (id: unknown) => ({ method: 'GET', query: { id } }) as unknown as NextApiRequest;
const response = () => ({ statusCode: 200, setHeader: vi.fn(),
  status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; },
  body: undefined as unknown }) as unknown as NextApiResponse & { statusCode: number; body: any };
describe('JTV exact series hierarchy', () => {
  beforeEach(() => { vi.clearAllMocks(); mock.owner.mockResolvedValue('owner'); mock.series.mockResolvedValue(null); });
  it('does not disclose series to non-owner viewers', async () => {
    mock.owner.mockImplementation(async (_req: unknown, res: NextApiResponse) => { res.status(403).json({ error: 'not owner' }); return null; });
    const res = response(); await handler(req('jellyfin:abc'), res); expect(res.statusCode).toBe(403); expect(mock.series).not.toHaveBeenCalled();
  });
  it('rejects malformed series identity', async () => {
    const res = response(); await handler(req('../other'), res); expect(res.statusCode).toBe(400);
  });
  it('returns real admitted series hierarchy without synthetic episodes', async () => {
    mock.series.mockResolvedValue({ series: { id: 'jellyfin:abc', title: 'Series' }, seasons: [], episodes: [] });
    const res = response(); await handler(req('jellyfin:abc'), res);
    expect(res.statusCode).toBe(200); expect(res.body.episodes).toEqual([]);
  });
});
