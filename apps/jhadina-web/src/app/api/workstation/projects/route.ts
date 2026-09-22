import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createDirectorProjectMembership } from '@/lib/director-project-authority';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });

  const privileged = createServiceRoleClient();
  if (!privileged) return NextResponse.json({ ok: false, error: 'Director project store is not configured' }, { status: 503 });

  const { data, error } = await privileged
    .from('director_project_memberships')
    .select('project_id,role,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    projects: (data ?? []).map((row) => ({
      projectId: String(row.project_id),
      role: row.role,
      createdAt: row.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });

  let body: { defaultProject?: boolean } = {};
  try {
    body = await request.json() as { defaultProject?: boolean };
  } catch {
    // Empty body creates a new project; malformed JSON is not authority-bearing.
  }

  const privileged = createServiceRoleClient();
  if (!privileged) return NextResponse.json({ ok: false, error: 'Director project store is not configured' }, { status: 503 });

  const projectId = body.defaultProject === true
    ? `director:${user.id}:default`
    : `director:${user.id}:${crypto.randomUUID()}`;

  try {
    const authority = await createDirectorProjectMembership(privileged, {
      projectId,
      userId: user.id,
      role: 'owner',
    });
    return NextResponse.json({ ok: true, projectId: authority.projectId, role: authority.role }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'DIRECTOR_PROJECT_CREATE_FAILED' },
      { status: 409 },
    );
  }
}
