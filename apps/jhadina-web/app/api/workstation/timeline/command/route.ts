import { NextResponse } from 'next/server';
import { applyTimelineCommand, timelineCommandReason, type TimelineCommand } from '@jhadina/director-core/timeline-command';
import type { EditableTimeline } from '@jhadina/director-core/timeline-model';

export async function POST(request: Request) {
  const body = await request.json() as { timeline: EditableTimeline; command: TimelineCommand; approved?: boolean };
  if (!body.timeline || !body.command) return NextResponse.json({ ok: false, error: 'timeline and command are required' }, { status: 400 });

  const generative = body.command.type === 'generative-region';
  if (generative && !body.approved) {
    return NextResponse.json({ ok: false, status: 'pending_approval', reason: 'Generative timeline mutations require approval before execution.' }, { status: 202 });
  }

  const next = applyTimelineCommand(body.timeline, body.command);
  const previous = next.versions.at(-1);
  const version = (previous?.version ?? 0) + 1;
  const versionId = crypto.randomUUID();
  const entry = { id: versionId, version, parentVersionId: previous?.id, createdAt: new Date().toISOString(), createdBy: generative ? 'jhadina' as const : 'user' as const, message: timelineCommandReason(body.command), snapshotHash: `${versionId}:${version}` };
  const timeline = { ...next, versions: [...next.versions, entry] };

  return NextResponse.json({ ok: true, status: 'completed', timeline, audit: { event: 'director.timeline.mutated', projectId: timeline.projectId, operation: body.command.type, versionId, version } });
}
