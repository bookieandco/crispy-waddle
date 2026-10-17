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

  it('denies expired capabilities before owner lookup or contacting the provider', async () => {
    const expired = createJtvStreamCapability({
      ownerId: 'jhadina-owner', assetId: 'item-1', mode: 'vod', audience: 'local',
      territory: 'US', rightsEvidence: jtvEvidenceFingerprint(config.rightsEvidenceIds),
    }, secret, Math.floor(Date.now() / 1000) - 3600, 60);
    const res = response();
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    await handler(request(expired), res as NextApiResponse);
    expect(res.statusCode).toBe(403);
    expect(mocks.owner).not.toHaveBeenCalled();
    expect(mocks.accessible).not.toHaveBeenCalled();
    expect(upstream).not.toHaveBeenCalled();
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
  it('never sends provider credentials to a path escaping the configured Jellyfin subpath', async () => {
    const fetchUpstream = vi.fn();
    vi.stubGlobal('fetch', fetchUpstream);
    for (const malicious of ['/../../Admin', '/Videos/%2e%2e/Admin', '/Videos/%2FAdmin']) {
      mocks.provider.mockReturnValue({
        ...config, serverUrl: 'https://media.example.test/jellyfin',
        vodStreamPathTemplate: malicious,
      });
      const res = response();
      await handler(request(token()), res as NextApiResponse);
      expect(res.statusCode).toBe(503);
    }
    expect(fetchUpstream).not.toHaveBeenCalled();
  });

});

describe('JTV-LIVE HLS streaming canary (synthetic authorized media)', () => {
  beforeEach(() => {
    process.env.JHADINA_TV_STREAM_SIGNING_SECRET = secret;
    process.env.JHADINA_TV_OWNER_AUTH_USER_ID = 'jhadina-owner';
    process.env.JHADINA_TV_TERRITORY = 'US';
    process.env.JHADINA_PUBLIC_ORIGIN = 'https://tv.example.test';
    mocks.provider.mockReturnValue({ ...config });
    mocks.owner.mockResolvedValue('jhadina-owner');
    mocks.accessible.mockResolvedValue(true);
  });
  afterEach(() => {
    delete process.env.JHADINA_PUBLIC_ORIGIN;
    delete process.env.JHADINA_TV_STREAM_SIGNING_SECRET;
    delete process.env.JHADINA_TV_OWNER_AUTH_USER_ID;
    delete process.env.JHADINA_TV_TERRITORY;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });
  it('rechecks owner/rights before returning signed same-origin HLS segments', async () => {
    const fetchUpstream = vi.fn()
      .mockResolvedValueOnce(new Response('#EXTM3U\n#EXTINF:5,\npart000.ts\n', {
        status: 200, headers: { 'content-type': 'application/vnd.apple.mpegurl' },
      }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        status: 200, headers: { 'content-type': 'video/mp2t' },
      }));
    vi.stubGlobal('fetch', fetchUpstream);
    const res = response();
    await handler(request(token()), res as NextApiResponse);
    expect(res.statusCode).toBe(200);
    const rewritten = String(res.end.mock.calls[0]?.[0] ?? '');
    expect(rewritten).toContain('https://tv.example.test/api/jhadinatv/jellyfin/stream');
    expect(rewritten).not.toContain('media.example.test');
    expect(rewritten).not.toContain('server-only');
    const segment = new URL(rewritten.split('\n').find((line) => line.startsWith('https://'))!);
    const follow = request(segment.searchParams.get('token') ?? '');
    follow.query.resource = segment.searchParams.get('resource') ?? '';
    follow.query.resourceSig = segment.searchParams.get('resourceSig') ?? '';
    const segmentResponse = response();
    await handler(follow, segmentResponse as NextApiResponse);
    expect(segmentResponse.statusCode).toBe(200);
    expect(segmentResponse.write).toHaveBeenCalled();
    expect(mocks.accessible).toHaveBeenCalledTimes(2);
    expect(mocks.owner).toHaveBeenCalledTimes(2);
  });
  it('recognizes .m3u8 provider paths even with generic octet-stream MIME', async () => {
    mocks.provider.mockReturnValue({
      ...config, vodStreamPathTemplate: '/Videos/{id}/stream/master.m3u8',
    });
    const upstream = vi.fn().mockResolvedValue(new Response('#EXTM3U\n#EXTINF:5,\npart001.ts\n', {
      status: 200, headers: { 'content-type': 'application/octet-stream' },
    }));
    vi.stubGlobal('fetch', upstream);
    const res = response();
    await handler(request(token()), res as NextApiResponse);
    expect(res.statusCode).toBe(200);
    const data = String(res.end.mock.calls[0]?.[0] ?? '');
    expect(data).toContain('resourceSig=');
    expect(data).not.toContain('media.example.test');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
  });

  it('rejects tampered HLS resource signatures before upstream fetch', async () => {
    const fetchUpstream = vi.fn();
    vi.stubGlobal('fetch', fetchUpstream);
    const req = request(token());
    req.query.resource = '/Videos/item-1/secret.ts';
    req.query.resourceSig = 'not-a-valid-signature';
    const res = response();
    await handler(req, res as NextApiResponse);
    expect(res.statusCode).toBe(403);
    expect(fetchUpstream).not.toHaveBeenCalled();
  });
});
