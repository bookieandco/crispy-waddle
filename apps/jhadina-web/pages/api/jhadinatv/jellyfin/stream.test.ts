import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createJtvStreamCapability } from '../../../../lib/jhadinatv/stream-capability';
import { jtvEvidenceFingerprint } from '../../../../lib/jhadinatv/jellyfin-access';

const mocks = vi.hoisted(() => ({ owner: vi.fn(), provider: vi.fn(), accessible: vi.fn() }));
vi.mock('../../../../lib/jhadinatv/server-viewer', () => ({ requireJtvOwner: mocks.owner }));
vi.mock('../../../../lib/jhadinatv/jellyfin-provider', () => ({ getJellyfinProxyConfig: mocks.provider }));
vi.mock('../../../../lib/jhadinatv/jellyfin-access', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../lib/jhadinatv/jellyfin-access')>();
  return { ...original, jellyfinAssetIsAccessible: mocks.accessible };
});

import handler from './stream';

const secret = 'a-truly-long-and-private-jhadinatv-server-signing-key';
const config = {
  serverUrl: 'https://media.example.test', apiKey: 'server-only',
  userId: 'jellyfin-1', rights: ['playback', 'casting'],
  rightsEvidenceIds: ['approved-rights-1'], territories: ['US'],
  liveStreamPathTemplate: '/LiveTv/Channels/{id}/stream',
  vodStreamPathTemplate: '/Videos/{id}/stream',
};

function response() {
  const r: any = {
    statusCode: 200, headersSent: false,
    setHeader: vi.fn(),
    on: vi.fn(),
    status(code: number) { this.statusCode = code; return this; },
    json: vi.fn(function (this: any, value: unknown) { this.body = value; return this; }),
    end: vi.fn(), write: vi.fn(),
  };
  return r;
}

function token(assetId = 'item-1', audience: 'local' | 'cast' = 'local', territory = 'US') {
  return createJtvStreamCapability({
    ownerId: 'jhadina-owner', assetId, mode: 'vod', audience, territory,
    rightsEvidence: jtvEvidenceFingerprint(config.rightsEvidenceIds),
  }, secret);
}

function request(capability?: string, id = 'item-1'): NextApiRequest {
  return { method: 'GET', query: { id, mode: 'vod', token: capability }, headers: {}, on: vi.fn() } as unknown as NextApiRequest;
}

describe('JhadinaTV stream endpoint denial boundary', () => {
  beforeEach(() => {
    process.env.JHADINA_TV_STREAM_SIGNING_SECRET = secret;
    process.env.JHADINA_TV_OWNER_AUTH_USER_ID = 'jhadina-owner';
    process.env.JHADINA_TV_TERRITORY = 'US';
    mocks.provider.mockReturnValue({ ...config });
    mocks.owner.mockResolvedValue('jhadina-owner');
    mocks.accessible.mockResolvedValue(true);
  });
  afterEach(() => {
    delete process.env.JHADINA_TV_STREAM_SIGNING_SECRET;
    delete process.env.JHADINA_TV_OWNER_AUTH_USER_ID;
    delete process.env.JHADINA_TV_TERRITORY;
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('denies absent capability before calling any media provider', async () => {
    const res = response();
    await handler(request(), res as NextApiResponse);
    expect(res.statusCode).toBe(403);
    expect(mocks.accessible).not.toHaveBeenCalled();
    expect(mocks.owner).not.toHaveBeenCalled();
  });

  it('denies asset substitution even when the signed bearer is valid for another asset', async () => {
    const res = response();
    await handler(request(token(), 'item-2'), res as NextApiResponse);
    expect(res.statusCode).toBe(403);
    expect(mocks.accessible).not.toHaveBeenCalled();
  });

  it('denies revoked casting rights and changed territory', async () => {
    mocks.provider.mockReturnValue({ ...config, rights: ['playback'] });
    const cast = response();
    await handler(request(token('item-1', 'cast')), cast as NextApiResponse);
    expect(cast.statusCode).toBe(403);

    mocks.provider.mockReturnValue(config);
    process.env.JHADINA_TV_TERRITORY = 'GB';
    const geo = response();
    await handler(request(token()), geo as NextApiResponse);
    expect(geo.statusCode).toBe(403);
  });

  it('requires owner cookie for local playback, independently of bearer validity', async () => {
    mocks.owner.mockImplementation(async (_req: unknown, res: any) => {
      res.status(401).json({ error: 'No user' }); return null;
    });
    const res = response();
    await handler(request(token()), res as NextApiResponse);
    expect(res.statusCode).toBe(401);
    expect(mocks.accessible).not.toHaveBeenCalled();
  });

  it('denies when signing configuration is absent', async () => {
    delete process.env.JHADINA_TV_STREAM_SIGNING_SECRET;
    const res = response();
    await handler(request(token()), res as NextApiResponse);
    expect(res.statusCode).toBe(503);
  });
});
