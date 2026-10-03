import { NextResponse } from 'next/server';
import type { EditableTimeline } from '@jhadina/director-core/timeline-model';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { requireDirectorProjectAuthority } from '@/lib/director-project-authority';
import { DirectorWorkstationTimelineRepository } from '@/lib/director-workstation-timeline-repository';

function statusFor(message: string): number {
  if (/ACCESS_DENIED|CAPABILITY_DENIED|EDIT_AUTHORITY_REQUIRED/.test(message)) return 403;
  if (/STALE_REVISION/.test(message)) return 409;
  if (/REQUIRED|INVALID|MISMATCH/.test(message)) return 400;
  return 500;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });

    const projectId = new URL(request.url).searchParams.get('projectId')?.trim() ?? '';
    if (!projectId) return NextResponse.json({ ok: false, error: 'projectId is required' }, { status: 400 });

    const privileged = createServiceRoleClient();
    if (!privileged) return NextResponse.json({ ok: false, error: 'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED' }, { status: 503 });
    await requireDirectorProjectAuthority(privileged, { projectId, userId: user.id, capability: 'read' });

    const record = await new DirectorWorkstationTimelineRepository(privileged).load(projectId);
    if (!record) return NextResponse.json({ ok: false, error: 'DIRECTOR_TIMELINE_NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ ok: true, revision: record.revision, timeline: record.timeline });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DIRECTOR_TIMELINE_READ_FAILED';
    return NextResponse.json({ ok: false, error: message }, { status: statusFor(message) });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json() as {
      timeline?: EditableTimeline;
      expectedRevision?: number;
      mutationId?: string;
      reason?: string;
    };
    const timeline = body.timeline;
    if (!timeline?.projectId) return NextResponse.json({ ok: false, error: 'timeline.projectId is required' }, { status: 400 });

    const privileged = createServiceRoleClient();
    if (!privileged) return NextResponse.json({ ok: false, error: 'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED' }, { status: 503 });
    await requireDirectorProjectAuthority(privileged, { projectId: timeline.projectId, userId: user.id, capability: 'edit' });

    const record = await new DirectorWorkstationTimelineRepository(privileged).save({
      projectId: timeline.projectId,
      userId: user.id,
      expectedRevision: body.expectedRevision ?? 0,
      mutationId: body.mutationId?.trim() || crypto.randomUUID(),
      timeline,
      reason: body.reason?.trim() || 'Initialize Workstation timeline',
    });
    return NextResponse.json({ ok: true, revision: record.revision, timeline: record.timeline }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DIRECTOR_TIMELINE_WRITE_FAILED';
    return NextResponse.json({ ok: false, error: message }, { status: statusFor(message) });
  }
}
