import { canonicalize, sha256Canonical, type CanonicalJson } from '@jhadina/core-spine';
import type { GenerationRequest } from './generation-provider';
import type { GenerationRegistry, LoRARecord } from './generation-registry';
import {
  validateWorkflowManifest,
  type GenerationWorkflowManifest,
  type WorkflowInputBinding,
  type WorkflowOutputBinding,
} from './generation-manifest';

export type WorkflowCompileInput = {
  manifest: GenerationWorkflowManifest;
  request: GenerationRequest;
  inputs: Record<string, unknown>;
};

export type CompiledWorkflow = {
  workflow: Record<string, unknown>;
  workflowId: string;
  workflowVersion: string;
  workflowSha256: string;
  requestFingerprint: string;
  submissionFingerprint: string;
  inputs: Record<string, unknown>;
  outputs: WorkflowOutputBinding[];
};

export type WorkflowCompilerOptions = { registry?: GenerationRegistry };

export class WorkflowCompiler {
  constructor(private readonly options: WorkflowCompilerOptions = {}) {}

  async compile(input: WorkflowCompileInput): Promise<CompiledWorkflow> {
    validateWorkflowManifest(input.manifest);
    this.validateRequest(input);
    this.validateBindings(input.manifest, input.inputs);

    const manifestHash = await sha256Canonical(input.manifest.workflow);
    if (manifestHash !== input.manifest.workflowSha256) {
      throw new Error(`Workflow manifest hash mismatch: ${input.manifest.id}@${input.manifest.version}`);
    }

    const workflow = structuredClone(input.manifest.workflow);
    for (const binding of input.manifest.inputBindings) {
      setPath(workflow, binding.nodeId, binding.fieldPath, structuredClone(input.inputs[binding.inputId]));
    }

    const canonicalWorkflow = canonicalize(workflow);
    const canonicalWorkflowValue = JSON.parse(canonicalWorkflow) as Record<string, unknown>;
    const identity = {
      fingerprintVersion: '1',
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
    };

    return {
      workflow: canonicalWorkflowValue,
      workflowId: input.manifest.id,
      workflowVersion: input.manifest.version,
      workflowSha256: input.manifest.workflowSha256,
      requestFingerprint: await sha256Canonical(identity),
      submissionFingerprint: await sha256Canonical({ ...identity, workflow: canonicalWorkflowValue }),
      inputs: structuredClone(input.inputs),
      outputs: structuredClone(input.manifest.outputBindings),
    };
  }

  private validateRequest(input: WorkflowCompileInput): void {
    if (input.request.modality !== input.manifest.modality) {
      throw new Error(`Request modality does not match workflow manifest: ${input.manifest.id}`);
    }
    if (input.request.model.providerId !== input.manifest.providerId) {
      throw new Error(`Model provider does not match workflow provider: ${input.request.model.id}`);
    }
    if (this.options.registry) {
      const registered = this.options.registry.getModel(input.request.model.id);
      if (!registered) throw new Error(`Unknown model: ${input.request.model.id}`);
      if (registered.providerId !== input.manifest.providerId) {
        throw new Error(`Model registry provider mismatch: ${input.request.model.id}`);
      }
    }
    for (const entry of input.request.loras ?? []) {
      validateLoRA(entry.lora, input.request.model.id, input.request.modality, this.options.registry);
      if (entry.weight !== undefined && (entry.weight < 0 || entry.weight > 2)) {
        throw new Error(`Invalid LoRA weight: ${entry.lora.id}`);
      }
    }
  }

  private validateBindings(manifest: GenerationWorkflowManifest, inputs: Record<string, unknown>): void {
    for (const binding of manifest.inputBindings) {
      if (!(binding.nodeId in manifest.workflow)) {
        throw new Error(`Input binding targets unknown workflow node: ${binding.nodeId}`);
      }
      if (binding.required && !(binding.inputId in inputs)) {
        throw new Error(`Missing required workflow input: ${binding.inputId}`);
      }
      if (binding.inputId in inputs && !matchesType(inputs[binding.inputId], binding.valueType)) {
        throw new Error(`Workflow input has wrong type: ${binding.inputId}`);
      }
    }
    for (const binding of manifest.outputBindings) {
      if (!(binding.nodeId in manifest.workflow)) {
        throw new Error(`Output binding targets unknown workflow node: ${binding.nodeId}`);
      }
    }
  }
}

function setPath(workflow: Record<string, unknown>, nodeId: string, fieldPath: string, value: unknown): void {
  const node = workflow[nodeId];
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new Error(`Cannot bind input to non-object workflow node: ${nodeId}`);
  }
  const segments = fieldPath.split('.').filter(Boolean);
  if (segments.length === 0) throw new Error(`Invalid workflow field path: ${fieldPath}`);
  let cursor = node as Record<string, unknown>;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const next = cursor[segments[index]];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      throw new Error(`Input binding field path does not exist: ${nodeId}.${fieldPath}`);
    }
    cursor = next as Record<string, unknown>;
  }
  const leaf = segments[segments.length - 1];
  if (!(leaf in cursor)) throw new Error(`Input binding field does not exist: ${nodeId}.${fieldPath}`);
  cursor[leaf] = value;
}

function matchesType(value: unknown, type: WorkflowInputBinding['valueType']): boolean {
  if (type === 'text') return typeof value === 'string';
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'boolean') return typeof value === 'boolean';
  return typeof value === 'string' || (typeof value === 'object' && value !== null);
}

function validateLoRA(lora: LoRARecord, modelId: string, modality: GenerationRequest['modality'], registry?: GenerationRegistry): void {
  if (!lora.modalities.includes(modality)) throw new Error(`LoRA does not support modality: ${lora.id}`);
  if (registry) {
    const model = registry.getModel(modelId);
    if (!model) throw new Error(`Unknown model: ${modelId}`);
    if (lora.baseModel !== model.baseModel) throw new Error(`LoRA base model mismatch: ${lora.id}`);
  }
}

export function asCanonicalWorkflow(value: Record<string, unknown>): CanonicalJson {
  return JSON.parse(canonicalize(value)) as CanonicalJson;
}
