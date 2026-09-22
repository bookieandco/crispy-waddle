import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  requireAuthority: vi.fn(),
  referenceRows: [] as Array<Record<string, unknown>>,
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

vi.mock('@/lib/director-project-authority', () => ({
  requireDirectorProjectAuthority: mocks.requireAuthority,
}));

function queryFor(table: string): any {
  const query: any = {
    select: () => query,
    eq: vi.fn(() => query),
    in: async () => ({
      data: table === 'director_reference_media_assets' ? mocks.referenceRows : [],
      error: null,
    }),
  };
  return query;
}

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      mocks.from(table);
      return queryFor(table);
    },
    rpc: mocks.rpc,
  }),
}));

import { POST } from './route';

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/director/products/bootstrap', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Director product bootstrap route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.referenceRows = [];
    mocks.getUser.mockResolvedValue({ data: { user: { id: '11111111-1111-1111-1111-111111111111' } } });
    mocks.requireAuthority.mockResolvedValue({
      projectId: 'project-a',
      userId: '11111111-1111-1111-1111-111111111111',
      role: 'owner',
    });
    mocks.rpc.mockResolvedValue({
      data: { id: 'product-bootstrap:1', status: 'reference_locked' },
      error: null,
    });
  });

  it('requires admitted product references and preserves exact label authority', async () => {
    mocks.referenceRows = [{
      id: 'product-ref-1',
      project_id: 'project-a',
      sha256: 'a'.repeat(64),
      reference_kind: 'product',
      view_hint: 'front',
      rights_ref: 'rights:owned',
      scan_evidence_ids: ['scanner:clean:product-ref-1'],
      admission_status: 'admitted',
      scan_status: 'clean',
    }];

    const response = await POST(request({
      projectId: 'project-a',
      productId: 'packnest',
      displayName: 'PackNest',
      referenceAssetIds: ['product-ref-1'],
      requiredLabelText: ['PACKNEST'],
    }));

    expect(response.status).toBe(201);
    const [rpcName, args] = mocks.rpc.mock.calls[0]!;
    expect(rpcName).toBe('create_director_product_bootstrap_job');
    expect(args.p_product_bible).toMatchObject({
      projectId: 'project-a',
      productId: 'packnest',
      displayName: 'PackNest',
      labelAuthorities: [{
        assetId: 'product-ref-1',
        text: 'PACKNEST',
        surface: 'front',
      }],
    });
  });

  it('rejects quarantined product references before persistence', async () => {
    mocks.referenceRows = [{
      id: 'product-ref-1',
      project_id: 'project-a',
      sha256: 'a'.repeat(64),
      reference_kind: 'product',
      view_hint: 'hero',
      rights_ref: 'rights:owned',
      scan_evidence_ids: [],
      admission_status: 'quarantined',
      scan_status: 'pending',
    }];

    const response = await POST(request({
      projectId: 'project-a',
      productId: 'packnest',
      displayName: 'PackNest',
      referenceAssetIds: ['product-ref-1'],
    }));

    expect(response.status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('checks project authority before reading product references', async () => {
    mocks.requireAuthority.mockRejectedValue(new Error('DIRECTOR_PROJECT_ACCESS_DENIED'));

    const response = await POST(request({
      projectId: 'project-foreign',
      productId: 'packnest',
      displayName: 'PackNest',
      referenceAssetIds: ['product-ref-1'],
    }));

    expect(response.status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalledWith('director_reference_media_assets');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
