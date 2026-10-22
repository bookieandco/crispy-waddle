import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createClient }));
vi.mock('../../src/lib/supabase/public-config', () => ({
  getSupabasePublicConfig: () => ({ url: 'https://test.supabase.co', publishableKey: 'sb_publishable_test' }),
}));

import { requireJtvOwner } from './server-viewer';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const previousOwner = process.env.JHADINA_TV_OWNER_AUTH_USER_ID;

function req() {
  return { cookies: {} } as unknown as NextApiRequest;
}
function res() {
  return {
    statusCode: 200, body: null as unknown,
    getHeader: vi.fn(), setHeader: vi.fn(),
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  } as unknown as NextApiResponse & { statusCode: number; body: any };
}

describe('JhadinaTV private server owner guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockReturnValue({ auth: { getUser: mocks.getUser } });
    process.env.JHADINA_TV_OWNER_AUTH_USER_ID = owner;
  });
  afterEach(() => {
    if (previousOwner === undefined) delete process.env.JHADINA_TV_OWNER_AUTH_USER_ID;
    else process.env.JHADINA_TV_OWNER_AUTH_USER_ID = previousOwner;
  });

  it('fails closed without a commissioned server-side owner', async () => {
    delete process.env.JHADINA_TV_OWNER_AUTH_USER_ID;
    const response = res();
    expect(await requireJtvOwner(req(), response)).toBeNull();
    expect(response.statusCode).toBe(503);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('requires a verified Supabase Auth session, never a header identity', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('no session') });
    const response = res();
    expect(await requireJtvOwner(req(), response)).toBeNull();
    expect(response.statusCode).toBe(401);
  });

  it('denies a different logged-in Supabase user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: other } }, error: null });
    const response = res();
    expect(await requireJtvOwner(req(), response)).toBeNull();
    expect(response.statusCode).toBe(403);
  });

  it('admits only the exact configured owner', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: owner } }, error: null });
    const response = res();
    expect(await requireJtvOwner(req(), response)).toBe(owner);
    expect(response.statusCode).toBe(200);
  });

  it('fails closed on Supabase outages without trusting cached browser identity', async () => {
    mocks.getUser.mockRejectedValue(new Error('network unavailable'));
    const response = res();
    expect(await requireJtvOwner(req(), response)).toBeNull();
    expect(response.statusCode).toBe(503);
  });
});
