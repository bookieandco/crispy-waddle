import { NextResponse } from 'next/server';
import { createJhadinaIntegration } from '../../../../src/lib/integration/jhadinaIntegration';

const integration = createJhadinaIntegration();

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.projectId || !body.capability || !body.input) return NextResponse.json({ ok: false, error: 'projectId, capability and input are required' }, { status: 400 });
  if (!['edit.assembleFavorites', 'edit.generative'].includes(body.capability)) return NextResponse.json({ ok: false, error: 'unsupported edit capability' }, { status: 400 });
  const result = await integration.orchestrator.handle({ id: crypto.randomUUID(), userId: body.userId, projectId: body.projectId, domain: 'directoros', capability: body.capability, input: body.input, requestedAt: new Date().toISOString(), requiresApproval: false });
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
