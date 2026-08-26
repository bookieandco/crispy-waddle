import { describe, expect, it } from 'vitest';
import { GenerationRegistry } from './generation-registry';
import { GenerationService } from './generation-service';
import { SrtCounterProvider } from './srt-counter-provider';
import { InMemoryGeneratedAssetRepository } from './generated-asset-resolver';
import { generationJobsFromEditPlan, type EditPlan } from './edit-plan';

describe('SRT counter generation through GenerationService', () => {
  it('executes an srt-counter edit operation and persists the subtitle asset', async () => {
    const registry = new GenerationRegistry();
    registry.registerProvider({
      id: 'director-local', name: 'Director Local', kind: 'local',
      capabilities: ['text-to-subtitle'], models: ['srt-counter-v1'], health: 'healthy',
    });
    registry.registerModel({
      id: 'srt-counter-v1', providerId: 'director-local', name: 'SRT Counter', version: '1',
      modalities: ['subtitle'], capabilities: ['text-to-subtitle'],
    });

    const provider = new SrtCounterProvider(registry.getProvider('director-local')!);
    const assets = new InMemoryGeneratedAssetRepository();
    const service = new GenerationService(registry, new Map([['director-local', provider]]), assets);
    const plan: EditPlan = {
      id: 'plan-1', title: 'Counter demo', version: '1.0.0', status: 'ready',
      operations: [{
        id: 'edit:counter-1', sourceId: 'source-1', kind: 'srt-counter',
        startSeconds: 2, endSeconds: 5, intent: 'Count dollars from zero to five',
        parameters: { start: 0, end: 5, durationMs: 100, prefix: '$' },
      }],
    };
    const operation = plan.operations[0];
    const jobs = generationJobsFromEditPlan(plan);
    expect(jobs[0]).toMatchObject({ kind: 'srt-counter', status: 'queued' });

    const job = await service.submitEditOperation(operation, 'project-1', 'srt-counter-v1');

    expect(job.status).toBe('completed');
    expect(job.request.modality).toBe('subtitle');
    expect(job.providerId).toBe('director-local');

    const stored = await assets.listByGenerationJob(job.id);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      projectId: 'project-1', generationJobId: job.id, providerId: 'director-local',
      mediaType: 'subtitle', mimeType: 'application/x-subrip',
    });

    const uri = stored[0].uri;
    expect(uri.startsWith('data:text/plain;base64,')).toBe(true);
    const decoded = Buffer.from(uri.split(',')[1], 'base64').toString('utf8');
    expect(decoded).toContain('1\n00:00:00,000 --> 00:00:00,100\n$0');
    expect(decoded).toContain('6\n00:00:00,500 --> 00:00:00,600\n$5');
  });
});
