import { describe, expect, it } from 'vitest';
import { WorkflowCompiler, type WorkflowCompileInput } from './workflow-compiler';
import type { GenerationWorkflowManifest } from './generation-manifest';

const workflowSha256 = 'f6b9add433ff508e918bc6a1d1c925460934c080ec9ea7474e060405fbd01017';

function fixture(): WorkflowCompileInput {
  const manifest: GenerationWorkflowManifest = {
    id: 'text-fixture', name: 'Text fixture', version: '1.0.0', providerId: 'p1', modality: 'image',
    capabilities: ['text-to-image'], apiFormat: 'comfyui-api', workflowSha256,
    workflow: { '1': { class_type: 'CLIPTextEncode', inputs: { text: 'placeholder' } } },
    exposedInputs: [{ id: 'prompt', type: 'text', required: true }],
    inputBindings: [{ inputId: 'prompt', nodeId: '1', fieldPath: 'inputs.text', valueType: 'text', required: true }],
    outputBindings: [{ outputId: 'image', nodeId: '1', outputField: 'images', mediaType: 'image', required: true, primary: true }],
  };
  return {
    manifest,
    request: {
      requestId: 'req-1', projectId: 'project-1', modality: 'image', prompt: 'hello',
      model: { id: 'model-1', providerId: 'p1', name: 'model', version: '1', modalities: ['image'], capabilities: ['text-to-image'] },
      parameters: {},
    },
    inputs: { prompt: 'hello' },
  };
}

describe('WorkflowCompiler', () => {
  it('compiles deterministically and preserves the manifest hash', async () => {
    const result = await new WorkflowCompiler().compile(fixture());
    expect(result.workflowSha256).toBe(workflowSha256);
    expect(result.workflow['1']).toEqual({ class_type: 'CLIPTextEncode', inputs: { text: 'hello' } });
    expect(result.requestFingerprint).toHaveLength(64);
    expect(result.submissionFingerprint).toHaveLength(64);
  });

  it('rejects a manifest hash mismatch', async () => {
    const input = fixture();
    input.manifest = { ...input.manifest, workflowSha256: '0'.repeat(64) };
    await expect(new WorkflowCompiler().compile(input)).rejects.toThrow(/hash mismatch/);
  });

  it('rejects a missing required input', async () => {
    const input = fixture();
    input.inputs = {};
    await expect(new WorkflowCompiler().compile(input)).rejects.toThrow(/Missing required workflow input/);
  });

  it('rejects an unknown binding target', async () => {
    const input = fixture();
    input.manifest = { ...input.manifest, inputBindings: [{ ...input.manifest.inputBindings[0], nodeId: 'missing' }] };
    await expect(new WorkflowCompiler().compile(input)).rejects.toThrow(/unknown workflow node/);
  });

  it('rejects a binding field that does not exist', async () => {
    const input = fixture();
    input.manifest = { ...input.manifest, inputBindings: [{ ...input.manifest.inputBindings[0], fieldPath: 'inputs.missing' }] };
    await expect(new WorkflowCompiler().compile(input)).rejects.toThrow(/field path does not exist/);
  });

  it('rejects a model/provider mismatch', async () => {
    const input = fixture();
    input.request.model = { ...input.request.model, providerId: 'p2' };
    await expect(new WorkflowCompiler().compile(input)).rejects.toThrow(/Model provider/);
  });
});
