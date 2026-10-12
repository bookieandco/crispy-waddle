import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const mocks = vi.hoisted(() => ({
  owner: vi.fn(), search: vi.fn(), ask: vi.fn(), guideStatus: vi.fn(), channels: vi.fn(),
}));
vi.mock('../../../lib/jhadinatv/server-viewer', () => ({ requireJtvOwner: mocks.owner }));
vi.mock('../../../lib/jhadinatv/server-catalog', () => ({
  jhadinaTVServerRuntime: { search: mocks.search, ask: mocks.ask },
  jhadinaTVLiveProvider: { id: 'jellyfin', name: 'Jellyfin', listChannels: mocks.channels },
}));
vi.mock('../../../lib/jhadinatv/jellyfin-provider', () => ({
  getJellyfinAdmissionStatus: mocks.guideStatus,
}));
import search from './search';
import ask from './ask';
import status from './live/status';
import guide from './live/guide';

function request(method = 'GET'): NextApiRequest {
  return { method, query: {} } as unknown as NextApiRequest;
}
function response(): any {
  return { statusCode: 200, setHeader: vi.fn(),
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; },
  };
}

describe('personal JhadinaTV discovery privacy', () => {
  beforeEach(() => {
    mocks.owner.mockImplementation(async (_req: unknown, res: any) => {
      res.status(403).json({ error: 'not owner' }); return null;
    });
    mocks.search.mockResolvedValue([]);
    mocks.ask.mockResolvedValue([]);
    mocks.channels.mockResolvedValue([]);
    mocks.guideStatus.mockReturnValue({ admitted: true, missing: [] });
  });
  afterEach(() => vi.clearAllMocks());

  it('denies personal catalog, AI recommendations, admission metadata and live guide to a non-owner', async () => {
    for (const handler of [search, ask, status, guide]) {
      const res = response();
      await handler(request(), res as NextApiResponse);
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: 'not owner' });
    }
    expect(mocks.search).not.toHaveBeenCalled();
    expect(mocks.ask).not.toHaveBeenCalled();
    expect(mocks.channels).not.toHaveBeenCalled();
    expect(mocks.guideStatus).not.toHaveBeenCalled();
  });

  it('rejects non-GET methods before reaching personal catalog', async () => {
    const res = response();
    await search(request('POST'), res as NextApiResponse);
    expect(res.statusCode).toBe(405);
    expect(mocks.owner).not.toHaveBeenCalled();
  });

  it('serves only the verified owner once authorized', async () => {
    mocks.owner.mockResolvedValue('jhadina-owner');
    mocks.search.mockResolvedValue([{ id: 'owned-media', title: 'Owned Media' }]);
    const res = response();
    await search(request(), res as NextApiResponse);
    expect(res.statusCode).toBe(200);
    expect(res.body.titles[0].id).toBe('owned-media');
  });
});
