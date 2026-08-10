import { NextResponse } from 'next/server';
import { createJhadinaIntegration } from '../../../../src/lib/integration/jhadinaIntegration';

const integration = createJhadinaIntegration();

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.projectId || !body.sceneId || !body.takeId) {
    return NextResponse.json({ ok: false, error: 'projectId, sceneId and takeId are required' }, { status: 400 });
  }
  const result = await integration.orchestrator.handle({
    id: crypto.randomUUID(), userId: body.userId, projectId: body.projectId,
    domain: 'directoros', capability: 'take.select',
    input: { projectId: body.projectId, sceneId: body.sceneId, take: { id: body.takeId } },
    requestedAt: new Date().toISOString(), requiresApproval: false,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
