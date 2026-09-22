import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { SupabaseStoryboardRepository } from '@jhadina/director-core/storyboard-persistence';
import { SupabaseDirectorProductionAuthorityRepository } from '@jhadina/director-core';
import { createDirectorReadClient } from '../../lib/director-read-client';
import { SupabaseDirectorReviewRepository } from '../../lib/director-review-repository';
import { SupabaseDirectorReviewTransitionRepository } from '../../lib/director-review-transition-repository';

function fixture(payload: unknown = [], status = 200) {
  const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } }));
  const client = createClient('https://director.test', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch },
  });
  return { client, fetch };
}

describe('Director repositories with the installed Supabase SDK', () => {
  it('preserves project scope and latest-version ordering through the read adapter', async () => {
    const { client, fetch } = fixture();
    const readClient = createDirectorReadClient(client);
    expect(await new SupabaseStoryboardRepository(readClient).getBinding('board', 'project')).toBeNull();
    expect(await new SupabaseDirectorProductionAuthorityRepository(readClient).getGate('gate', 'run', 'project')).toBeNull();
    const binding = new URL(String(fetch.mock.calls[0][0]));
    expect(binding.searchParams.get('storyboard_board_id')).toBe('eq.board');
    expect(binding.searchParams.get('project_id')).toBe('eq.project');
    expect(binding.searchParams.get('order')).toBe('version.desc');
    expect(binding.searchParams.get('limit')).toBe('1');
    const gate = new URL(String(fetch.mock.calls[1][0]));
    expect(gate.searchParams.get('id')).toBe('eq.gate');
    expect(gate.searchParams.get('run_id')).toBe('eq.run');
    expect(gate.searchParams.get('project_id')).toBe('eq.project');
  });

  it('awaits review filter builders and retains asset and project scope', async () => {
    const { client, fetch } = fixture();
    const repo = new SupabaseDirectorReviewRepository(client);
    expect(await repo.listEvidence('asset', 'project')).toEqual([]);
    expect(await repo.getAsset('asset', 'project')).toBeNull();
    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(url.searchParams.get('artifact_id')).toBe('eq.asset');
    expect(url.searchParams.get('project_id')).toBe('eq.project');
  });

  it('propagates database errors rather than treating them as missing records', async () => {
    const { client } = fixture({ message: 'permission denied', code: '42501' }, 403);
    await expect(new SupabaseStoryboardRepository(createDirectorReadClient(client)).getSequence('sequence', 'project')).rejects.toThrow('permission denied');
    await expect(new SupabaseDirectorReviewRepository(client).listEvidence('asset', 'project')).rejects.toThrow('permission denied');
  });

  it('awaits an SDK RPC builder and sends the expected review versions', async () => {
    const { client, fetch } = fixture({ applied: true });
    expect(await new SupabaseDirectorReviewTransitionRepository(client).apply({
      decisionId: 'decision', projectId: 'project', reviewStageId: 'review', expectedReviewVersion: 2,
      generationStageId: 'generation', expectedGenerationVersion: 3, nextReviewStatus: 'approved',
      nextGenerationStatus: 'approved', reason: 'review accepted',
    })).toEqual({ applied: true });
    expect(String(fetch.mock.calls[0][0])).toContain('/rpc/apply_director_review_transition');
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({
      p_project_id: 'project', p_review_version: 2, p_generation_version: 3, p_successor_version: null,
    });
  });
});
