import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
const mocks = vi.hoisted(() => ({ owner: vi.fn() }));
vi.mock('../../../../lib/jhadinatv/server-viewer', () => ({ requireJtvOwner: mocks.owner }));
import handler from './channels';
function res(): any { return { code: 200, setHeader: vi.fn(), status(v: number) { this.code = v; return this; },
  json(value: unknown) { this.body = value; return this; } }; }
function req(query: Record<string, string> = {}): NextApiRequest {
  return { method: 'GET', query } as unknown as NextApiRequest;
}
describe('world channel discovery never issues playback media', () => {
  beforeEach(() => { mocks.owner.mockResolvedValue('verified-owner'); });
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
  it('hides directory from unauthorized users', async () => {
    mocks.owner.mockImplementation(async (_req: unknown, res: any) => { res.status(403).json({ error: 'owner only' }); return null; });
    const result = res(); await handler(req(), result as NextApiResponse);
    expect(result.code).toBe(403);
  });
  it('filters country and never exposes an unverified stream URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, headers: { get: () => null }, text: async () => JSON.stringify([
        { id: 'One.us', name: 'One News', country: 'US', categories: ['news'], website: 'https://news.example.org' , url: 'https://unverified.media/stream' },
        { id: 'Two.fr', name: 'Two France', country: 'FR', categories: ['general'] },
        { id: 'Adult.us', name: 'Adult', country: 'US', is_nsfw: true },
      ]),
    }));
    const result = res(); await handler(req({ country: 'US', q: 'news' }), result as NextApiResponse);
    expect(result.code).toBe(200);
    expect(result.body.channels).toHaveLength(1);
    expect(result.body.channels[0].access).toBe('discovery-only');
    expect(JSON.stringify(result.body)).not.toContain('unverified.media');
  });
});
