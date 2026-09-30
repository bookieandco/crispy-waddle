import { describe, expect, it } from 'vitest';
import { createWorkflowFingerprint } from './workflow-fingerprint.js';

const base = {
  manifest: { id: 'video-workflow', version: '1', providerId: 'comfy', modality: 'video' as const },
  request: {
    modality: 'video' as const,
    prompt: 'replace character',
    negativePrompt: 'blur',
    model: { id: 'model-a', providerId: 'comfy', version: '1' },
    loras: [{ lora: { id: 'lora-a', weight: 0.8 } }],
    references: [{ assetId: 'ref-a', role: 'character' as const }],
    parameters: { seed: 42, steps: 20 },
  },
  workflow: { b: 2, a: { z: 3, y: 4 } },
};

describe('createWorkflowFingerprint', () => {
  it('is stable when object key order changes', () => {
    const reordered = {
      ...base,
      workflow: { a: { y: 4, z: 3 }, b: 2 },
      request: { ...base.request, parameters: { steps: 20, seed: 42 } },
    };
    expect(createWorkflowFingerprint(base)).toBe(createWorkflowFingerprint(reordered));
  });

  it('changes when workflow content changes', () => {
    expect(createWorkflowFingerprint(base)).not.toBe(
      createWorkflowFingerprint({ ...base, workflow: { b: 3, a: { z: 3, y: 4 } } }),
    );
  });

  it('changes when execution identity changes', () => {
    expect(createWorkflowFingerprint(base)).not.toBe(
      createWorkflowFingerprint({
        ...base,
        request: { ...base.request, model: { ...base.request.model, version: '2' } },
      }),
    );
  });
});
