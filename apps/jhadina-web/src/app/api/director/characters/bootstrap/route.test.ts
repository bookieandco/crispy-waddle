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
    eq: () => query,
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
  return new Request('http://localhost/api/director/characters/bootstrap', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Director character bootstrap route', () => {
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
      data: { id: 'character-bootstrap:1', status: 'reference_locked' },
      error: null,
    });
  });

  it('rejects a forged project before any reference read or cast mutation', async () => {
    mocks.requireAuthority.mockRejectedValue(new Error('DIRECTOR_PROJECT_ACCESS_DENIED'));

    const response = await POST(request({
      projectId: 'project-foreign',
      characterId: 'ela',
      displayName: 'Ela',
      archetype: 'cartoon',
      referenceAssetIds: ['ref-1'],
    }));

    expect(response.status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalledWith('director_reference_media_assets');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('refuses quarantined reference media before the atomic bootstrap RPC', async () => {
    mocks.referenceRows = [{
      id: 'ref-1',
      project_id: 'project-a',
      sha256: 'sha-ref',
      width: 1024,
      height: 1024,
      view_hint: 'front',
      rights_ref: 'rights:owned',
      consent_ref: 'consent:owned',
      scan_evidence_ids: [],
      admission_status: 'quarantined',
      scan_status: 'pending',
    }];

    const response = await POST(request({
      projectId: 'project-a',
      characterId: 'ela',
      displayName: 'Ela',
      archetype: 'cartoon',
      referenceAssetIds: ['ref-1'],
    }));

    expect(response.status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('sends admitted references and the locked Cast Bible through one atomic RPC', async () => {
    mocks.referenceRows = [{
      id: 'ref-1',
      project_id: 'project-a',
      sha256: 'sha-ref',
      width: 1024,
      height: 1024,
      view_hint: 'front',
      rights_ref: 'rights:owned',
      consent_ref: 'consent:owned',
      scan_evidence_ids: ['scanner:clean:ref-1'],
      admission_status: 'admitted',
      scan_status: 'clean',
    }];

    const response = await POST(request({
      projectId: 'project-a',
      characterId: 'ela',
      displayName: 'Ela',
      archetype: 'cartoon',
      referenceAssetIds: ['ref-1'],
      lockedTraits: ['brown eyes'],
    }));

    expect(response.status).toBe(201);
    expect(mocks.rpc).toHaveBeenCalledOnce();
    const [name, args] = mocks.rpc.mock.calls[0]!;
    expect(name).toBe('create_director_character_bootstrap_job');
    expect(args).toMatchObject({
      p_project_id: 'project-a',
      p_character_id: 'ela',
      p_reference_asset_ids: ['ref-1'],
    });
    expect(args.p_cast_record).toMatchObject({
      projectId: 'project-a',
      characterId: 'ela',
      continuityRef: 'character:ela:v1',
      canonicalAppearanceVariantId: 'appearance:ela:base',
    });
    expect(args.p_cast_record.appearanceVariants[0]).toMatchObject({
      referenceAssetIds: ['ref-1'],
      referenceSha256s: ['sha-ref'],
    });
  });
});
