import { NextResponse } from 'next/server';
import { applyTimelineCommand, timelineCommandReason, type TimelineCommand } from '@jhadina/director-core/timeline-command';
import type { EditableTimeline, TimelineSnapshot } from '@jhadina/director-core/timeline-model';

type HistoryCommand = TimelineCommand | { type: 'undo'; targetVersionId?: string } | { type: 'redo'; targetVersionId: string };

type Body = { timeline: EditableTimeline; command: HistoryCommand; approved?: boolean };

function snapshotOf(timeline: EditableTimeline): TimelineSnapshot {
  return {
    tracks: timeline.tracks,
    transitions: timeline.transitions,
    markers: timeline.markers,
    playheadSeconds: timeline.playheadSeconds,
  };
}

function restoreSnapshot(timeline: EditableTimeline, snapshot: TimelineSnapshot): EditableTimeline {
  return { ...timeline, ...snapshot };
}

export async function POST(request: Request) {
  const body = await request.json() as Body;
  if (!body.timeline || !body.command) return NextResponse.json({ ok: false, error: 'timeline and command are required' }, { status: 400 });

  const generative = body.command.type === 'generative-region';
  if (generative && !body.approved) {
    return NextResponse.json({ ok: false, status: 'pending_approval', reason: 'Generative timeline mutations require approval before execution.' }, { status: 202 });
  }

  const currentVersion = body.timeline.versions.at(-1);
  let next: EditableTimeline;
  let message: string;
  let revertsVersionId: string | undefined;
  let restoresVersionId: string | undefined;

  if (body.command.type === 'undo') {
    const targetId = body.command.targetVersionId ?? currentVersion?.parentVersionId;
    if (!targetId) return NextResponse.json({ ok: false, status: 'rejected', error: 'Nothing to undo.' }, { status: 409 });
    const target = body.timeline.versions.find(version => version.id === targetId);
    if (!target?.snapshot) return NextResponse.json({ ok: false, status: 'rejected', error: 'Undo target has no persisted snapshot.' }, { status: 409 });
    next = restoreSnapshot(body.timeline, target.snapshot);
    message = `Undo to v${target.version}`;
    revertsVersionId = currentVersion?.id;
    restoresVersionId = target.id;
  } else if (body.command.type === 'redo') {
    const target = body.timeline.versions.find(version => version.id === body.command.targetVersionId);
    if (!target?.snapshot) return NextResponse.json({ ok: false, status: 'rejected', error: 'Redo target has no persisted snapshot.' }, { status: 409 });
    next = restoreSnapshot(body.timeline, target.snapshot);
    message = `Redo v${target.version}`;
    restoresVersionId = target.id;
  } else {
    next = applyTimelineCommand(body.timeline, body.command);
    message = timelineCommandReason(body.command);
  }

  const version = (currentVersion?.version ?? 0) + 1;
  const versionId = crypto.randomUUID();
  const entry = {
    id: versionId,
    version,
    parentVersionId: currentVersion?.id,
    createdAt: new Date().toISOString(),
    createdBy: generative ? 'jhadina' as const : 'user' as const,
    message,
    snapshotHash: `${versionId}:${version}`,
    snapshot: snapshotOf(next),
    revertsVersionId,
    restoresVersionId,
  };
  const timeline = { ...next, versions: [...next.versions, entry] };

  return NextResponse.json({
    ok: true,
    status: 'completed',
    timeline,
    version: entry,
    audit: {
      event: 'director.timeline.mutated',
      projectId: timeline.projectId,
      operation: body.command.type,
      versionId,
      version,
      parentVersionId: entry.parentVersionId,
      revertsVersionId,
      restoresVersionId,
    },
  });
}
