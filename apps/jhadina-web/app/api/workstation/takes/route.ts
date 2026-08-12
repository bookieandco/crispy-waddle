import { NextResponse } from 'next/server';
import { createJhadinaIntegration } from '../../../../src/lib/integration/jhadinaIntegration';

const integrations = new Map<string, ReturnType<typeof createJhadinaIntegration>>();

function getIntegration() {
  const key = 'default';
  let integration = integrations.get(key);
  if (!integration) {
    integration = createJhadinaIntegration();
    integrations.set(key, integration);
  }
  return integration;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { projectId, userId, capability = 'take.generate', input } = body;
  if (!projectId || !input) {
    return NextResponse.json({ ok: false, error: 'projectId and input are required' }, { status: 400 });
  }

  const integration = getIntegration();
  const result = await integration.orchestrator.request({
    id: crypto.randomUUID(),
    userId,
    projectId,
    domain: 'directoros',
    capability,
    input,
    requestedAt: new Date().toISOString(),
    requiresApproval: false,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
