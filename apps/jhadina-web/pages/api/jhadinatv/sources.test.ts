import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyJtvStreamCapability } from '../../../lib/jhadinatv/stream-capability';

const mocks = vi.hoisted(() => ({ owner: vi.fn(), provider: vi.fn(), accessible: vi.fn(), resolve: vi.fn() }));
vi.mock('../../../lib/jhadinatv/server-viewer', () => ({ requireJtvOwner: mocks.owner }));
vi.mock('../../../lib/jhadinatv/jellyfin-provider', () => ({ getJellyfinProxyConfig: mocks.provider }));
vi.mock('../../../lib/jhadinatv/jellyfin-access', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../lib/jhadinatv/jellyfin-access')>();
  return { ...original, jellyfinAssetIsAccessible: mocks.accessible };
});
vi.mock('../../../lib/jhadinatv/server-catalog', () => ({
  jhadinaTVServerRegistry: { resolveSources: mocks.resolve },
}));

import handler from './sources';

const secret = 'another-long-private-key-for-source-token-issuance';

const source = {
  id: 'jellyfin:vod:item-1', titleId: 'jellyfin:item-1', kind: 'external',
  url: 'https://jhadina.example.test/api/jhadinatv/jellyfin/stream?id=item-1&mode=vod',
  authorization: { status: 'authorized', rights: ['playback', 'casting'], rightsEvidenceIds: ['contract-1'] },
};

function res(): any {
  return {
    statusCode: 200, setHeader: vi.fn(),
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; },
  };
}
function req(provider = 'jellyfin'): NextApiRequest {
  return { method: 'GET', query: { provider, id: 'jellyfin:item-1' } } as unknown as NextApiRequest;
}

describe('JhadinaTV source issuance', () => {
  beforeEach(() => {
    process.env.JHADINA_TV_STREAM_SIGNING_SECRET = secret;
    process.env.JHADINA_TV_OWNER_AUTH_USER_ID = 'jhadina-owner';
    process.env.JHADINA_TV_TERRITORY = 'US';
    mocks.owner.mockResolvedValue('jhadina-owner');
    mocks.provider.mockReturnValue({
      serverUrl: 'https://media.example.test', apiKey: 'secret', userId: 'jellyfin-user',
      rights: ['playback', 'casting'], rightsEvidenceIds: ['contract-1'], territories: ['US'],
    });
    mocks.accessible.mockResolvedValue(true);
    mocks.resolve.mockResolvedValue([{ providerId: 'jellyfin', source }]);
  });
  afterEach(() => {
    delete process.env.JHADINA_TV_STREAM_SIGNING_SECRET;
    delete process.env.JHADINA_TV_OWNER_AUTH_USER_ID;
    delete process.env.JHADINA_TV_TERRITORY;
    vi.clearAllMocks();
  });

  it('does not issue sources to an unauthorized viewer', async () => {
    mocks.owner.mockImplementation(async (_req: unknown, response: any) => { response.status(403).json({ error: 'denied' }); return null; });
    const response = res();
    await handler(req(), response as NextApiResponse);
    expect(response.statusCode).toBe(403);
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it('does not issue sources for an inaccessible asset or unsupported provider', async () => {
    mocks.accessible.mockResolvedValue(false);
    const missing = res();
    await handler(req(), missing as NextApiResponse);
    expect(missing.statusCode).toBe(404);
    expect(mocks.resolve).not.toHaveBeenCalled();
    const unknown = res();
    await handler(req('arbitrary-stream'), unknown as NextApiResponse);
    expect(unknown.statusCode).toBe(403);
  });

  it('issues separate local and cast capability URLs only when separately authorized', async () => {
    const response = res();
    await handler(req(), response as NextApiResponse);
    expect(response.statusCode).toBe(200);
    const entry = response.body.sources[0].source;
    const local = new URL(entry.url);
    const cast = new URL(entry.castUrl);
    expect(verifyJtvStreamCapability(local.searchParams.get('token')!, secret)?.audience).toBe('local');
    expect(verifyJtvStreamCapability(cast.searchParams.get('token')!, secret)?.audience).toBe('cast');
    expect(cast.searchParams.get('id')).toBe('item-1');
  });

  it('never issues a cast URL when the casting right is absent', async () => {
    mocks.resolve.mockResolvedValue([{ providerId: 'jellyfin', source: {
      ...source, authorization: { ...source.authorization, rights: ['playback'] },
    } }]);
    const response = res();
    await handler(req(), response as NextApiResponse);
    expect(response.statusCode).toBe(200);
    expect(response.body.sources[0].source.castUrl).toBeUndefined();
  });
});
