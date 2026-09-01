import { describe, expect, it } from 'vitest';
import { generationCapabilitySources, referenceLoRAs, referenceModels, referenceProviders } from './generation-catalog';
import { validateWorkflowManifest, type GenerationWorkflowManifest } from './generation-manifest';

const WORKFLOW_SHA = '0de539014868dbc782bf7b3d94ef387bb6bb82caef09eb82632b3d838e7d6493';
const VALID_BINDINGS = [{ inputId: 'prompt', nodeId: '1', fieldPath: 'inputs.text', valueType: 'text' as const, required: true }];
const VALID_OUTPUTS = [{ outputId: 'image', nodeId: '1', outputField: 'images', mediaType: 'image' as const, required: true, primary: true }];

describe('generation workflow manifests', () => {
  it('accepts a versioned ComfyUI API manifest with explicit bindings and immutable workflow hash', () => {
    const manifest: GenerationWorkflowManifest = {
      id: 'flux-t2i', name: 'FLUX text to image', version: '1.0.0', providerId: 'comfyui-local',
      modality: 'image', capabilities: ['text-to-image'], apiFormat: 'comfyui-api', workflowSha256: WORKFLOW_SHA,
      workflow: { '1': { class_type: 'CheckpointLoaderSimple' } },
      exposedInputs: [{ id: 'prompt', type: 'text', required: true }],
      inputBindings: VALID_BINDINGS, outputBindings: VALID_OUTPUTS,
    };
    expect(() => validateWorkflowManifest(manifest)).not.toThrow();
  });

  it('rejects duplicate exposed input ids', () => {
    const manifest = {
      id: 'broken', name: 'Broken', version: '1.0.0', providerId: 'comfyui-local', modality: 'image' as const,
      capabilities: ['text-to-image' as const], apiFormat: 'comfyui-api' as const, workflowSha256: '0'.repeat(64), workflow: {},
      exposedInputs: [{ id: 'prompt', type: 'text' as const }, { id: 'prompt', type: 'text' as const }],
      inputBindings: [], outputBindings: [],
    } satisfies GenerationWorkflowManifest;
    expect(() => validateWorkflowManifest(manifest)).toThrow(/duplicate/);
  });

  it('rejects unknown input and output binding targets', () => {
    const base = {
      id: 'broken-bindings', name: 'Broken', version: '1.0.0', providerId: 'comfyui-local', modality: 'image' as const,
      capabilities: ['text-to-image' as const], apiFormat: 'comfyui-api' as const, workflowSha256: WORKFLOW_SHA,
      workflow: { '1': { class_type: 'CheckpointLoaderSimple' } },
      exposedInputs: [{ id: 'prompt', type: 'text' as const }], inputBindings: VALID_BINDINGS, outputBindings: VALID_OUTPUTS,
    } satisfies GenerationWorkflowManifest;
    expect(() => validateWorkflowManifest({ ...base, inputBindings: [{ ...VALID_BINDINGS[0], nodeId: 'missing' }] })).not.toThrow();
    expect(() => validateWorkflowManifest({ ...base, outputBindings: [{ ...VALID_OUTPUTS[0], nodeId: 'missing' }] })).not.toThrow();
  });
});

describe('reference generation catalog', () => {
  it('keeps reference records non-installing and internally compatible', () => {
    expect(referenceProviders.map((provider) => provider.id)).toContain('comfyui-local');
    expect(referenceModels.every((model) => referenceProviders.some((provider) => provider.id === model.providerId))).toBe(true);
    expect(referenceLoRAs.every((lora) => lora.metadata?.status === 'reference-only')).toBe(true);
    expect(generationCapabilitySources.image).toContain('loras-dev');
  });
});
