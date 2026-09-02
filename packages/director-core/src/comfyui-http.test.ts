import { describe, expect, it, vi } from 'vitest';
import { createComfyUIHttpClient } from './comfyui-http';

describe('createComfyUIHttpClient', () => {
  it('queues a workflow through ComfyUI /prompt', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ prompt_id: 'job-123' }), { status: 200 }));
    const client = createComfyUIHttpClient({ baseUrl: 'http://localhost:8188/', fetchImpl });

    await expect(client.queuePrompt({ '1': { class_type: 'CheckpointLoaderSimple' } })).resolves.toEqual({ promptId: 'job-123' });
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:8188/prompt', expect.objectContaining({ method: 'POST' }));
  });

  it('propagates a stable client idempotency key to ComfyUI', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ prompt_id: 'job-456' }), { status: 200 }));
    const client = createComfyUIHttpClient({ baseUrl: 'http://localhost:8188', fetchImpl });

    await expect(client.queuePrompt({ '1': { class_type: 'CheckpointLoaderSimple' } }, { clientId: 'generation:123' })).resolves.toEqual({ promptId: 'job-456' });
    const request = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      prompt: { '1': { class_type: 'CheckpointLoaderSimple' } },
      client_id: 'generation:123',
    });
  });

  it('finds an existing prompt by its stable client idempotency key', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      old: { prompt: [1, 'other-key', {}], outputs: {} },
      target: { prompt: [2, 'generation:123', {}], outputs: {} },
    }), { status: 200 }));
    const client = createComfyUIHttpClient({ baseUrl: 'http://localhost:8188', fetchImpl });

    await expect(client.findPromptByClientId?.('generation:123')).resolves.toBe('target');
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:8188/history', expect.objectContaining({ method: 'GET' }));
  });

  it('returns undefined when no prompt matches the stable client idempotency key', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ old: { prompt: [1, 'other-key', {}] } }), { status: 200 }));
    const client = createComfyUIHttpClient({ baseUrl: 'http://localhost:8188', fetchImpl });

    await expect(client.findPromptByClientId?.('missing')).resolves.toBeUndefined();
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
