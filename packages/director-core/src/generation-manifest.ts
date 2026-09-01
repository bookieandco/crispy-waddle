import type { GenerationModality, ProviderCapability } from './generation-registry';

export type WorkflowInputType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'image'
  | 'video'
  | 'audio'
  | 'model'
  | 'lora';

export type WorkflowInputBinding = {
  inputId: string;
  nodeId: string;
  fieldPath: string;
  valueType: WorkflowInputType;
  required: boolean;
};

export type WorkflowOutputBinding = {
  outputId: string;
  nodeId: string;
  outputField: string;
  mediaType: 'image' | 'video' | 'audio' | '3d' | 'motion';
  required: boolean;
  primary?: boolean;
};

export type GenerationWorkflowManifest = {
  id: string;
  name: string;
  version: string;
  providerId: string;
  modality: GenerationModality;
  capabilities: ProviderCapability[];
  apiFormat: 'comfyui-api';
  /** SHA-256 of the canonical workflow payload. Immutable workflow identity is id+version+workflowSha256. */
  workflowSha256: string;
  workflow: Record<string, unknown>;
  exposedInputs: Array<{
    id: string;
    type: WorkflowInputType;
    required?: boolean;
    default?: unknown;
  }>;
  inputBindings: WorkflowInputBinding[];
  outputBindings: WorkflowOutputBinding[];
  source?: {
    uri?: string;
    sha256?: string;
    license?: string;
  };
  metadata?: Record<string, unknown>;
};

export type GeneratedAssetRecord = {
  id: string;
  generationJobId: string;
  kind: 'image' | 'video' | 'audio' | '3d' | 'motion';
  uri: string;
  mimeType: string;
  sha256?: string;
  modelId: string;
  workflowId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export function validateWorkflowManifest(manifest: GenerationWorkflowManifest): void {
  if (!manifest.id || !manifest.version || !manifest.providerId) {
    throw new Error('Workflow manifest requires id, version, and providerId');
  }
  if (manifest.apiFormat !== 'comfyui-api') {
    throw new Error(`Unsupported workflow format: ${manifest.apiFormat}`);
  }
  if (!manifest.workflow || typeof manifest.workflow !== 'object' || Array.isArray(manifest.workflow)) {
    throw new Error(`Workflow manifest has no workflow payload: ${manifest.id}`);
  }
  if (!/^[a-f0-9]{64}$/.test(manifest.workflowSha256)) {
    throw new Error(`Workflow manifest has invalid workflowSha256: ${manifest.id}`);
  }

  const exposedIds = new Set(manifest.exposedInputs.map((input) => input.id));
  if (exposedIds.size !== manifest.exposedInputs.length) {
    throw new Error(`Workflow manifest has duplicate exposed input IDs: ${manifest.id}`);
  }

  const bindingIds = new Set(manifest.inputBindings.map((binding) => binding.inputId));
  if (bindingIds.size !== manifest.inputBindings.length) {
    throw new Error(`Workflow manifest has duplicate input binding IDs: ${manifest.id}`);
  }
  for (const binding of manifest.inputBindings) {
    if (!exposedIds.has(binding.inputId)) {
      throw new Error(`Workflow manifest input binding references unknown input: ${binding.inputId}`);
    }
    if (!binding.nodeId || !binding.fieldPath) {
      throw new Error(`Workflow manifest input binding is incomplete: ${binding.inputId}`);
    }
  }

  const outputIds = new Set(manifest.outputBindings.map((binding) => binding.outputId));
  if (outputIds.size !== manifest.outputBindings.length) {
    throw new Error(`Workflow manifest has duplicate output binding IDs: ${manifest.id}`);
  }
  if (manifest.outputBindings.filter((binding) => binding.primary).length > 1) {
    throw new Error(`Workflow manifest has multiple primary outputs: ${manifest.id}`);
  }
  for (const binding of manifest.outputBindings) {
    if (!binding.nodeId || !binding.outputField) {
      throw new Error(`Workflow manifest output binding is incomplete: ${binding.outputId}`);
    }
  }
}
