import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
const mock = vi.hoisted(() => ({ owner: vi.fn(), db: vi.fn(), admission: vi.fn() }));
vi.mock('../../../lib/jhadinatv/server-viewer', () => ({
  requireJtvOwner: mock.owner, createJtvOwnerClient: mock.db,
}));
vi.mock('../../../lib/jhadinatv/jellyfin-provider', () => ({
  getJellyfinAdmissionStatus: mock.admission,
}));
import handler from './postmerge';

function response() {
  return { code: 200, setHeader: vi.fn(),
    status(code: number) { this.code = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
    body: null as unknown,
  } as unknown as NextApiResponse & { code: number; body: any };
}
function request(method = 'GET') { return { method, query: {}, cookies: {} } as unknown as NextApiRequest; }
const dbStub = (error: unknown) => ({
  from: () => ({
    select: () => ({
      limit: async () => ({ error }),
    }),
  }),
});

describe('JTV POSTMERGE owner-only readiness (never asserts actual playback)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.owner.mockResolvedValue('owner-uuid');
    mock.db.mockReturnValue(dbStub(null));
    mock.admission.mockReturnValue({ admitted: true, missing: [] });
    process.env.JHADINA_TV_STREAM_SIGNING_SECRET = 'S'.repeat(48);
  });
  it('does not expose provider or storage checks to anonymous viewers', async () => {
    mock.owner.mockImplementation(async (_request: unknown, res: NextApiResponse) => {
      res.status(401).json({ error: 'sign in required' }); return null;
    });
    const res = response();
    await handler(request(), res);
    expect(res.code).toBe(401);
    expect(mock.db).not.toHaveBeenCalled();
    expect(mock.admission).not.toHaveBeenCalled();
  });
  it('rejects unsafe methods', async () => {
    const res = response();
    await handler(request('POST'), res);
    expect(res.code).toBe(405);
    expect(mock.owner).not.toHaveBeenCalled();
  });
  it('denies readiness when storage is unavailable', async () => {
    mock.db.mockReturnValue(dbStub({ code: '57P03' }));
    const res = response();
    await handler(request(), res);
    expect(res.code).toBe(503);
    expect(res.body.preparedForHumanDeviceCanary).toBe(false);
    expect(res.body.storageReadable).toBe(false);
    expect(res.body.liveCertified).toBe(false);
  });
  it('reports readiness-to-test but never falsely certifies live viewing', async () => {
    const res = response();
    await handler(request(), res);
    expect(res.code).toBe(200);
    expect(res.body.preparedForHumanDeviceCanary).toBe(true);
    expect(res.body.actualMediaRightsVerified).toBe(false);
    expect(res.body.physicalDeviceVerified).toBe(false);
    expect(res.body.liveCertified).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain('owner-uuid');
  });
  it('does not accept an absent signing secret', async () => {
    delete process.env.JHADINA_TV_STREAM_SIGNING_SECRET;
    const res = response();
    await handler(request(), res);
    expect(res.code).toBe(503);
    expect(res.body.missing).toContain('JHADINA_TV_STREAM_SIGNING_SECRET');
  });
});
