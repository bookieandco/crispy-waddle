import { NextRequest, NextResponse } from 'next/server';
import type { StudyControlAction } from '@/lib/study-control';
import { controlStudyJob, type StudyJobControlStore } from '@/lib/study-control-server';

export interface StudyControlRouteDependencies {
  store: StudyJobControlStore;
  authenticate(request: NextRequest): Promise<{ actorId: string } | null>;
}

export function createStudyControlRoute(deps: StudyControlRouteDependencies) {
  return async function POST(request: NextRequest) {
    const identity = await deps.authenticate(request);
    if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const studyId = typeof body.studyId === 'string' ? body.studyId.trim() : '';
    const action = body.action as StudyControlAction;
    const allowed: StudyControlAction[] = ['start', 'pause', 'resume', 'stop', 'promote-learning'];
    if (!studyId || !allowed.includes(action)) {
      return NextResponse.json({ error: 'studyId and a valid action are required' }, { status: 400 });
    }

    try {
      const job = await deps.store.get(studyId);
      if (!job) return NextResponse.json({ error: 'Study not found' }, { status: 404 });
      const updated = await controlStudyJob(deps.store, studyId, action);
      return NextResponse.json({ success: true, actorId: identity.actorId, study: updated });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Study control failed' }, { status: 500 });
    }
  };
}
