import { canonicalize, sha256Canonical, type CanonicalJson } from '@jhadina/core-spine';
import type { GenerationRequest } from './generation-provider.js';
import type { GenerationWorkflowManifest } from './generation-manifest.js';

export const WORKFLOW_FINGERPRINT_VERSION = '1' as const;

export interface WorkflowFingerprintInput {
  manifest: Pick<GenerationWorkflowManifest, 'id' | 'version' | 'providerId' | 'modality'>;
  request: Pick<GenerationRequest, 'modality' | 'prompt' | 'negativePrompt' | 'loras' | 'references' | 'parameters'> & {
    model: { id: string; providerId: string; version: string };
  };
  workflow: CanonicalJson;
}

export function createWorkflowFingerprint(input: WorkflowFingerprintInput): string {
  return sha256Canonical({
    fingerprintVersion: WORKFLOW_FINGERPRINT_VERSION,
    providerId: input.manifest.providerId,
    workflowId: input.manifest.id,
    workflowVersion: input.manifest.version,
    modality: input.request.modality,
    model: {
      id: input.request.model.id,
      providerId: input.request.model.providerId,
      version: input.request.model.version,
    },
    prompt: input.request.prompt,
    negativePrompt: input.request.negativePrompt ?? null,
    loras: input.request.loras ?? [],
    references: input.request.references ?? [],
    parameters: input.request.parameters,
    workflow: input.workflow,
  });
}

export function canonicalWorkflow(input: CanonicalJson): string {
  return canonicalize(input);
}
