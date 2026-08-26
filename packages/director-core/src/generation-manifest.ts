import type { GenerationModality, ProviderCapability } from './generation-registry';

export type GenerationWorkflowManifest = {
  id: string;
  name: string;
  version: string;
  providerId: string;
  modality: GenerationModality;
  capabilities: ProviderCapability[];
  apiFormat: 'comfyui-api';
  workflow: Record<string, unknown>;
  exposedInputs: Array<{
    id: string;
    type: 'text' | 'number' | 'boolean' | 'image' | 'video' | 'audio' | 'model' | 'lora';
    required?: boolean;
    default?: unknown;
  }>;
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
  if (!manifest.workflow || typeof manifest.workflow !== 'object') {
    throw new Error(`Workflow manifest has no workflow payload: ${manifest.id}`);
  }
  if (new Set(manifest.exposedInputs.map((input) => input.id)).size !== manifest.exposedInputs.length) {
    throw new Error(`Workflow manifest has duplicate exposed input IDs: ${manifest.id}`);
  }
}
