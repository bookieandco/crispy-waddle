import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  analyzeDogReference,
  dogReferenceQuality,
  dogVisionConfigured,
} from '@/lib/roboflow-dog-vision';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Roboflow dog vision adapter', () => {
  it('stays server-only and optional when the gateway is not configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await analyzeDogReference({
      bytes: Buffer.from('image'),
      mimeType: 'image/jpeg',
      env: {},
    });

    expect(result).toEqual({ status: 'not_configured' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(dogVisionConfigured({})).toBe(false);
  });

  it('derives the dog-vision route from the authenticated media gateway', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          model_id: 'dogs-gxbwe/1',
          workflow_id: 'general-segmentation-api',
          workspace: 'morrisdorian84-gmail-com',
          dog_detected: true,
          detection_count: 1,
          segmentation_count: 1,
          max_confidence: 0.94,
          largest_subject_fraction: 0.52,
          predictions: [{ class: 'dog', confidence: 0.94 }],
          segments: [{ class: 'dog', confidence: 0.91, points_count: 42 }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const result = await analyzeDogReference({
      bytes: Buffer.from('image'),
      mimeType: 'image/jpeg',
      runWorkflow: true,
      env: {
        PUPSON_BACKGROUND_REMOVER_URL: 'https://media.example.test/',
        PUPSON_BACKGROUND_REMOVER_TOKEN: 'server-token',
      },
    });

    expect(result.status).toBe('ok');
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe('https://media.example.test/dog-vision');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer server-token');
    expect(init?.method).toBe('POST');
  });

  it('only penalizes dog-specific quality issues after a dog is detected', () => {
    expect(
      dogReferenceQuality({
        status: 'ok',
        model_id: 'dogs-gxbwe/1',
        workflow_id: null,
        workspace: null,
        dog_detected: false,
        detection_count: 0,
        segmentation_count: 0,
        max_confidence: null,
        largest_subject_fraction: null,
        predictions: [],
        segments: [],
      })
    ).toEqual({ score: 100, findings: [] });

    const result = dogReferenceQuality({
      status: 'ok',
      model_id: 'dogs-gxbwe/1',
      workflow_id: 'general-segmentation-api',
      workspace: 'morrisdorian84-gmail-com',
      dog_detected: true,
      detection_count: 2,
      segmentation_count: 1,
      max_confidence: 0.51,
      largest_subject_fraction: 0.05,
      predictions: [],
      segments: [],
    });

    expect(result.score).toBe(70);
    expect(result.findings).toHaveLength(3);
  });
});
