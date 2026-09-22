import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { STUDIO_QC_CHECKS } from '@jhadina/director-core/studio-asset-approval';
import { recordPassedDirectorStudioQC } from './director-studio-qc-repository';

function client(returned: Record<string, unknown>) {
  const single = vi.fn(async () => ({ data: returned, error: null }));
  const query: any = {
    insert: vi.fn(() => query),
    select: vi.fn(() => query),
    single,
  };
  return {
    client: { from: vi.fn(() => query) } as unknown as SupabaseClient,
    query,
    single,
  };
}

describe('Director Studio QC persistence', () => {
  it('rejects incomplete final QC evidence before touching storage', async () => {
    const fake = client({});
    await expect(recordPassedDirectorStudioQC(fake.client, {
      id: 'qc-1',
      projectId: 'project-a',
      assetId: 'asset-a',
      provider: 'qc-provider',
      minimumObservedScore: 0.91,
      evidenceIds: ['qc-check:tracking:0.99'],
    })).rejects.toThrow('DIRECTOR_STUDIO_QC_REPORT_INVALID');
    expect(fake.query.insert).not.toHaveBeenCalled();
  });

  it('persists a complete passed QC report for later human approval', async () => {
    const evidenceIds = STUDIO_QC_CHECKS.map((check) => `qc-check:${check}:0.95`);
    const fake = client({
      id: 'qc-1',
      project_id: 'project-a',
      asset_id: 'asset-a',
      provider: 'qc-provider',
      minimum_observed_score: 0.95,
      evidence_ids: evidenceIds,
      action_request_id: 'action-1',
      created_at: '2026-09-22T17:10:50.000Z',
    });

    await expect(recordPassedDirectorStudioQC(fake.client, {
      id: 'qc-1',
      projectId: 'project-a',
      assetId: 'asset-a',
      provider: 'qc-provider',
      minimumObservedScore: 0.95,
      evidenceIds,
      actionRequestId: 'action-1',
      createdAt: '2026-09-22T17:10:50.000Z',
    })).resolves.toMatchObject({
      id: 'qc-1',
      projectId: 'project-a',
      assetId: 'asset-a',
      minimumObservedScore: 0.95,
      evidenceIds,
    });
    expect(fake.query.insert).toHaveBeenCalledOnce();
  });
});
