import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { directorRoleAllows, requireDirectorProjectAuthority } from './director-project-authority';

function clientWith(row: unknown, error: { message: string } | null = null): SupabaseClient {
  const query: any = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: row, error }),
  };
  return { from: () => query } as unknown as SupabaseClient;
}

describe('Director project authority', () => {
  it('allows viewer read but not edit or approval', () => {
    expect(directorRoleAllows('viewer', 'read')).toBe(true);
    expect(directorRoleAllows('viewer', 'edit')).toBe(false);
    expect(directorRoleAllows('viewer', 'approve')).toBe(false);
  });

  it('allows owner and editor mutation capabilities', () => {
    for (const role of ['owner', 'editor'] as const) {
      expect(directorRoleAllows(role, 'edit')).toBe(true);
      expect(directorRoleAllows(role, 'approve')).toBe(true);
    }
  });

  it('fails closed when the authenticated user is not a project member', async () => {
    await expect(requireDirectorProjectAuthority(clientWith(null), {
      projectId: 'project-a',
      userId: 'user-b',
      capability: 'read',
    })).rejects.toThrow('DIRECTOR_PROJECT_ACCESS_DENIED');
  });

  it('fails closed when a viewer attempts a mutation', async () => {
    await expect(requireDirectorProjectAuthority(clientWith({
      project_id: 'project-a',
      user_id: 'user-a',
      role: 'viewer',
    }), {
      projectId: 'project-a',
      userId: 'user-a',
      capability: 'edit',
    })).rejects.toThrow('DIRECTOR_PROJECT_CAPABILITY_DENIED');
  });

  it('returns exact authenticated membership authority', async () => {
    await expect(requireDirectorProjectAuthority(clientWith({
      project_id: 'project-a',
      user_id: 'user-a',
      role: 'editor',
    }), {
      projectId: 'project-a',
      userId: 'user-a',
      capability: 'approve',
    })).resolves.toEqual({ projectId: 'project-a', userId: 'user-a', role: 'editor' });
  });

  it('does not convert repository failures into authorization success', async () => {
    await expect(requireDirectorProjectAuthority(clientWith(null, { message: 'database unavailable' }), {
      projectId: 'project-a',
      userId: 'user-a',
      capability: 'read',
    })).rejects.toThrow('DIRECTOR_PROJECT_AUTHORITY_READ_FAILED:database unavailable');
  });
});
