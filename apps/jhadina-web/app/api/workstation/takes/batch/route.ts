import { NextResponse } from 'next/server';
import { createJhadinaIntegration } from '../../../../../src/lib/integration/jhadinaIntegration';

const integration = createJhadinaIntegration();

const VARIATIONS = ['continuity', 'performance', 'camera', 'timing', 'comedy', 'emotion', 'experimental'] as const;

export async function POST(request: Request) {
  const body = await request.json();
  const { projectId, sceneId, userId, prompt, count = 3, parentTakeId, locked = ['character', 'wardrobe', 'location', 'lens', 'lighting', 'color', 'audio'] } = body;
  if (!projectId || !sceneId || !prompt) return NextResponse.json({ ok: false, error: 'projectId, sceneId and prompt are required' }, { status: 400 });

  const takeCount = Math.max(1, Math.min(8, Number(count) || 3));
  const results = [];
  for (let i = 0; i < takeCount; i += 1) {
    const variation = VARIATIONS[i % VARIATIONS.length];
    const instruction = `${prompt}\nVariation role: ${variation}. Preserve all locked continuity dimensions unless the instruction explicitly requests otherwise.`;
    const result = await integration.orchestrator.handle({
      id: crypto.randomUUID(), userId, projectId, domain: 'directoros', capability: 'take.generate',
      input: { projectId, sceneId, parentTakeId, prompt: instruction, locked, variation },
      requestedAt: new Date().toISOString(), requiresApproval: false,
    });
    results.push({ variation, result });
  }
  return NextResponse.json({ ok: true, count: results.length, candidates: results });
}
