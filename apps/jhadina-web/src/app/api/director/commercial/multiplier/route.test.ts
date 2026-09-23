import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  requireAuthority: vi.fn(),
  sourceCreative: null as Record<string, unknown> | null,
  inserted: null as Record<string, unknown> | null,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

vi.mock('@/lib/director-project-authority', () => ({
  requireDirectorProjectAuthority: mocks.requireAuthority,
}));

function queryFor(table: string): any {
  const q: any = {
    select: () => q,
    eq: vi.fn(() => q),
    maybeSingle: async () => ({
      data: table === 'director_commercial_creatives' ? mocks.sourceCreative : null,
      error: null,
    }),
    insert: vi.fn((row: Record<string, unknown>) => {
      mocks.inserted = row;
      return {
        select: () => ({
          single: async () => ({ data: row, error: null }),
        }),
      };
    }),
  };
  return q;
}

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => queryFor(table),
  }),
}));

import { POST } from './route';

const plan = {
  id: 'multiplier:hooks',
  projectId: 'project-a',
  sourceCreativeId: 'creative:control',
  experimentIsolation: 'single-axis' as const,
  variants: [{
    id: 'creative:hook-a',
    parentCreativeId: 'creative:control',
    mutationAxis: 'hook' as const,
    replacementRef: 'hook:a',
    replacementEvidenceIds: ['evidence:hook-a'],
    replacementRightsEvidenceIds: [],
    preserveProductIdentity: true,
    preserveCharacterIdentity: true,
    preserveStoryStructure: true,
  }],
};

function request(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/director/commercial/multiplier', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: 'project-a', plan, ...body }),
  });
}

describe('Director commercial multiplier route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: '11111111-1111-1111-1111-111111111111' } },
    });
    mocks.requireAuthority.mockResolvedValue({
      projectId: 'project-a',
      userId: '11111111-1111-1111-1111-111111111111',
      role: 'owner',
    });
    mocks.sourceCreative = { id: 'creative:control', project_id: 'project-a' };
    mocks.inserted = null;
  });

  it('persists a governed multiplier plan only when its source creative exists in the same project', async () => {
    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(mocks.inserted).toMatchObject({
      id: 'multiplier:hooks',
      project_id: 'project-a',
      source_creative_id: 'creative:control',
      plan: expect.objectContaining({
        authority: 'PRODUCTION_PLAN_ONLY',
        experimentIsolation: 'single-axis',
      }),
    });
    expect(await response.json()).toMatchObject({
      campaignAuthority: 'NONE',
      experimentIsolation: 'single-axis',
    });
  });

  it('rejects a multiplier whose source creative is not present in the project', async () => {
    mocks.sourceCreative = null;

    const response = await POST(request());

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'DIRECTOR_AD_SOURCE_CREATIVE_NOT_FOUND' });
    expect(mocks.inserted).toBeNull();
  });

  it('rejects mixed-axis variants when the plan claims single-axis causal isolation', async () => {
    const response = await POST(request({
      plan: {
        ...plan,
        variants: [
          plan.variants[0],
          {
            ...plan.variants[0],
            id: 'creative:cta-a',
            mutationAxis: 'cta',
            replacementRef: 'cta:a',
          },
        ],
      },
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'DIRECTOR_AD_EXPERIMENT_SINGLE_AXIS_REQUIRED' });
    expect(mocks.inserted).toBeNull();
  });
});
