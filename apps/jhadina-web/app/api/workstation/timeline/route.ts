import { NextResponse } from 'next/server';
import { createJhadinaIntegration } from '../../../../src/lib/integration/jhadinaIntegration';

const integration = createJhadinaIntegration();

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.projectId || !body.operation) return NextResponse.json({ ok: false, error: 'projectId and operation are required' }, { status: 400 });
  const allowed = ['timeline.create', 'timeline.update', 'timeline.addGenerativeRegion', 'timeline.snapshot'];
  if (!allowed.includes(body.operation)) return NextResponse.json({ ok: false, error: 'unsupported timeline operation' }, { status: 400 });
  const result = await integration.orchestrator.handle({ id: crypto.randomUUID(), userId: body.userId, projectId: body.projectId, domain: 'directoros', capability: body.operation, input: body.input ?? {}, requestedAt: new Date().toISOString(), requiresApproval: body.operation.includes('Generative') });
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
