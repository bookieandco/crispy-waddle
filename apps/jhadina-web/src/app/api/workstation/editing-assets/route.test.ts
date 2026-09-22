import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  requireAuthority: vi.fn(),
  listByProject: vi.fn(),
  asset: null as null | Record<string, unknown>,
  report: null as null | Record<string, unknown>,
  approvalUpsert: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

vi.mock('@/lib/director-project-authority', () => ({
  requireDirectorProjectAuthority: mocks.requireAuthority,
}));

vi.mock('@/lib/supabase-generated-asset-repository', () => ({
  createSupabaseGeneratedAssetRepository: () => ({ listByProject: mocks.listByProject }),
}));

function queryFor(table: string): any {
  const query: any = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({
      data: table === 'director_generated_editing_assets' ? mocks.asset
        : table === 'director_studio_qc_reports' ? mocks.report
          : null,
      error: null,
    }),
    in: async () => ({ data: [], error: null }),
    upsert: async (value: unknown) => {
      mocks.approvalUpsert(value);
      return { error: null };
    },
  };
  return query;
}

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      mocks.from(table);
      return queryFor(table);
    },
  }),
}));

import { POST } from './route';

const completeEvidence = [
  'qc-check:tracking:0.95',
  'qc-check:composite:0.95',
  'qc-check:continuity:0.95',
  'qc-check:voice-sync:0.95',
  'qc-check:animation:0.95',
  'qc-check:physics:0.95',
];

describe('Workstation editing asset approval route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.asset = null;
    mocks.report = null;
    mocks.getUser.mockResolvedValue({ data: { user: { id: '11111111-1111-1111-1111-111111111111' } } });
    mocks.requireAuthority.mockResolvedValue({ projectId: 'project-a', userId: '11111111-1111-1111-1111-111111111111', role: 'owner' });
  });

  it('rejects a forged project before any project asset read', async () => {
    mocks.requireAuthority.mockRejectedValue(new Error('DIRECTOR_PROJECT_ACCESS_DENIED'));

    const response = await POST(new Request('http://localhost/api/workstation/editing-assets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'project-foreign', assetId: 'asset-a' }),
    }));

    expect(response.status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalledWith('director_generated_editing_assets');
    expect(mocks.approvalUpsert).not.toHaveBeenCalled();
  });

  it('ignores client-supplied fake QC and requires a persisted Studio report', async () => {
    mocks.asset = { id: 'asset-a', project_id: 'project-a', approval_policy: 'studio_qc' };

    const response = await POST(new Request('http://localhost/api/workstation/editing-assets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: 'project-a',
        assetId: 'asset-a',
        studioQC: { qcReportId: 'forged', minimumObservedScore: 1, evidenceIds: completeEvidence },
      }),
    }));

    expect(response.status).toBe(409);
    expect(mocks.from).toHaveBeenCalledWith('director_studio_qc_reports');
    expect(mocks.approvalUpsert).not.toHaveBeenCalled();
  });

  it('binds approval to persisted QC and the authenticated approver', async () => {
    mocks.asset = { id: 'asset-a', project_id: 'project-a', approval_policy: 'studio_qc' };
    mocks.report = {
      id: 'qc-real',
      minimum_observed_score: 0.95,
      evidence_ids: completeEvidence,
      passed: true,
    };

    const response = await POST(new Request('http://localhost/api/workstation/editing-assets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: 'project-a',
        assetId: 'asset-a',
        studioQC: { qcReportId: 'forged', minimumObservedScore: 1, evidenceIds: [] },
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.approvalUpsert).toHaveBeenCalledWith(expect.objectContaining({
      asset_id: 'asset-a',
      approval_id: 'approval:asset-a:11111111-1111-1111-1111-111111111111',
      approved_by_user_id: '11111111-1111-1111-1111-111111111111',
      qc_report_id: 'qc-real',
      qc_min_score: 0.95,
      qc_evidence_ids: completeEvidence,
    }));
  });
});
