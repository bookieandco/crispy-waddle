import { describe, expect, it, vi } from 'vitest';
import { createComfyUIHttpClient } from './comfyui-http';

describe('createComfyUIHttpClient', () => {
  it('queues a workflow through ComfyUI /prompt', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ prompt_id: 'job-123' }), { status: 200 }));
    const client = createComfyUIHttpClient({ baseUrl: 'http://localhost:8188/', fetchImpl });

    await expect(client.queuePrompt({ '1': { class_type: 'CheckpointLoaderSimple' } })).resolves.toEqual({ promptId: 'job-123' });
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:8188/prompt', expect.objectContaining({ method: 'POST' }));
  });

  it('unwraps a prompt history entry', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ 'job-123': { outputs: { '1': {} } } }), { status: 200 }));
    const client = createComfyUIHttpClient({ baseUrl: 'http://localhost:8188', fetchImpl });

    await expect(client.getHistory('job-123')).resolves.toEqual({ outputs: { '1': {} } });
  });

  it('interrupts a queued generation through /interrupt', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    const client = createComfyUIHttpClient({ baseUrl: 'http://localhost:8188', fetchImpl });

    await expect(client.interrupt('job-123')).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:8188/interrupt', expect.objectContaining({ method: 'POST' }));
  });

  it('surfaces provider HTTP failures', async () => {
    const fetchImpl = vi.fn(async () => new Response('bad request', { status: 400 }));
    const client = createComfyUIHttpClient({ baseUrl: 'http://localhost:8188', fetchImpl });

    await expect(client.interrupt('job-123')).rejects.toThrow('ComfyUI request failed (400)');
  });
});
