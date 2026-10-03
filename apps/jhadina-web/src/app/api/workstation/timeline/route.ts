import { NextResponse } from 'next/server';
import type { EditableTimeline } from '@jhadina/director-core/timeline-model';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { requireDirectorProjectAuthority } from '@/lib/director-project-authority';
import { DirectorWorkstationTimelineRepository } from '@/lib/director-workstation-timeline-repository';

function emptyWorkstationTimeline(projectId:string):EditableTimeline {
  return {
    version:1,
    projectId,
    fps:30,
    width:1920,
    height:1080,
    durationSeconds:30,
    playheadSeconds:0,
    tracks:[
      {id:'video-1',name:'Video',kind:'video',clips:[],index:0},
      {id:'audio-1',name:'Audio',kind:'audio',clips:[],index:1},
    ],
    transitions:[],
    markers:[],
    versions:[],
  };
}

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
      projectId?: string;
      expectedRevision?: number;
      mutationId?: string;
      reason?: string;
    };
    const projectId=body.projectId?.trim()??'';
    if (!projectId) return NextResponse.json({ ok: false, error: 'projectId is required' }, { status: 400 });
    if (body.expectedRevision !== 0) {
      return NextResponse.json({ ok: false, error: 'DIRECTOR_TIMELINE_INITIALIZATION_REVISION_MUST_BE_ZERO' }, { status: 400 });
    }

    const privileged = createServiceRoleClient();
    if (!privileged) return NextResponse.json({ ok: false, error: 'DIRECTOR_PROJECT_STORE_NOT_CONFIGURED' }, { status: 503 });
    await requireDirectorProjectAuthority(privileged, { projectId, userId: user.id, capability: 'edit' });

    const timeline=emptyWorkstationTimeline(projectId);
    const record = await new DirectorWorkstationTimelineRepository(privileged).save({
      projectId,
      userId: user.id,
      expectedRevision: 0,
      mutationId: body.mutationId?.trim() || crypto.randomUUID(),
      timeline,
      reason: body.reason?.trim() || 'Initialize empty Workstation timeline',
    });
    return NextResponse.json({ ok: true, revision: record.revision, timeline: record.timeline }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DIRECTOR_TIMELINE_WRITE_FAILED';
    return NextResponse.json({ ok: false, error: message }, { status: statusFor(message) });
  }
}
