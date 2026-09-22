import type { SupabaseClient } from '@supabase/supabase-js';

export type DirectorProjectRole = 'owner' | 'editor' | 'viewer';
export type DirectorProjectCapability = 'read' | 'edit' | 'approve';

export type DirectorProjectAuthority = {
  projectId: string;
  userId: string;
  role: DirectorProjectRole;
};

const allowedRoles: Record<DirectorProjectCapability, readonly DirectorProjectRole[]> = {
  read: ['owner', 'editor', 'viewer'],
  edit: ['owner', 'editor'],
  approve: ['owner', 'editor'],
};

export function directorRoleAllows(role: DirectorProjectRole, capability: DirectorProjectCapability): boolean {
  return allowedRoles[capability].includes(role);
}

export async function requireDirectorProjectAuthority(
  client: SupabaseClient,
  input: { projectId: string; userId: string; capability: DirectorProjectCapability },
): Promise<DirectorProjectAuthority> {
  const projectId = input.projectId.trim();
  if (!projectId) throw new Error('DIRECTOR_PROJECT_ID_REQUIRED');
  if (!input.userId) throw new Error('DIRECTOR_USER_ID_REQUIRED');

  const { data, error } = await client
    .from('director_project_memberships')
    .select('project_id,user_id,role')
    .eq('project_id', projectId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (error) throw new Error(`DIRECTOR_PROJECT_AUTHORITY_READ_FAILED:${error.message}`);
  if (!data) throw new Error('DIRECTOR_PROJECT_ACCESS_DENIED');

  const role = data.role as DirectorProjectRole;
  if (!directorRoleAllows(role, input.capability)) {
    throw new Error('DIRECTOR_PROJECT_CAPABILITY_DENIED');
  }

  return { projectId, userId: input.userId, role };
}

export async function createDirectorProjectMembership(
  client: SupabaseClient,
  input: { projectId: string; userId: string; role: DirectorProjectRole },
): Promise<DirectorProjectAuthority> {
  const projectId = input.projectId.trim();
  if (!projectId || !input.userId) throw new Error('DIRECTOR_PROJECT_MEMBERSHIP_INVALID');

  const { error } = await client
    .from('director_project_memberships')
    .upsert(
      { project_id: projectId, user_id: input.userId, role: input.role },
      { onConflict: 'project_id,user_id' },
    );

  if (error) throw new Error(`DIRECTOR_PROJECT_MEMBERSHIP_WRITE_FAILED:${error.message}`);
  return { projectId, userId: input.userId, role: input.role };
}
