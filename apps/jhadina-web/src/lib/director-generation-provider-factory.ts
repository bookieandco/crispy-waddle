import {
  enforceArtifactDeployment,
  type ArtifactAdmissionLedger,
  type ArtifactDeploymentRequirement,
  type ArtifactDeploymentReceipt,
} from '@jhadina/reference-provenance';
import {
  ComfyUIProvider,
  createComfyUIHttpClient,
  GenerationRegistry,
  validateApprovedCharacterLoraRecord,
  type GenerationProvider,
  type GenerationProviderRecord,
  type LoRARecord,
  type ModelRecord,
} from '@jhadina/director-core';

export type DirectorGenerationFactoryConfig = {
  artifactDeployment?: {
    ledger: ArtifactAdmissionLedger;
    requirement: ArtifactDeploymentRequirement;
    verifiedAt?: string;
  };
  comfyUi?: {
    id?: string;
    name?: string;
    baseUrl: string;
    apiKey?: string;
    models: ModelRecord[];
  };
  approvedLoras?: LoRARecord[];
};

export type DirectorGenerationProviderRuntime = {
  registry: GenerationRegistry;
  providers: Map<string, GenerationProvider>;
  artifactDeployment: ArtifactDeploymentReceipt;
};

function readJsonEnv<T>(name: string): T | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`DIRECTOR_CONFIG_INVALID_JSON:${name}`);
  }
}

function defaultApprovedLoras(): LoRARecord[] | undefined {
  return readJsonEnv<LoRARecord[]>('DIRECTOR_APPROVED_LORAS_JSON');
}

function defaultComfyUiConfig(): DirectorGenerationFactoryConfig['comfyUi'] | undefined {
  const baseUrl = process.env.DIRECTOR_COMFYUI_URL;
  if (!baseUrl) return undefined;

  const models = readJsonEnv<ModelRecord[]>('DIRECTOR_COMFYUI_MODELS_JSON');
  if (!models?.length) {
    throw new Error('DIRECTOR_COMFYUI_MODELS_JSON_REQUIRED');
  }

  return {
    id: process.env.DIRECTOR_COMFYUI_PROVIDER_ID ?? 'comfyui-local',
    name: process.env.DIRECTOR_COMFYUI_PROVIDER_NAME ?? 'ComfyUI',
    baseUrl,
    apiKey: process.env.DIRECTOR_COMFYUI_API_KEY,
    models,
  };
}

function buildComfyUiDescriptor(config: NonNullable<DirectorGenerationFactoryConfig['comfyUi']>): GenerationProviderRecord {
  const capabilities = [...new Set(config.models.flatMap((model) => model.capabilities))];
  return {
    id: config.id ?? 'comfyui-local',
    name: config.name ?? 'ComfyUI',
    kind: 'comfyui',
    endpoint: config.baseUrl,
    capabilities,
    models: config.models.map((model) => model.id),
    health: 'unknown',
    metadata: { configurationSource: 'environment' },
  };
}

function buildWorkflow(request: Parameters<NonNullable<GenerationProvider['submit']>>[0]): Record<string, unknown> {
  const workflow = request.parameters.workflow;
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    throw new Error('DIRECTOR_COMFYUI_WORKFLOW_REQUIRED');
  }
  return workflow as Record<string, unknown>;
}

/**
 * Canonical server-only Director provider construction boundary.
 *
 * Production configuration is explicit and fail-closed. Reference catalog
 * records are never promoted to live providers. ComfyUI workflow JSON is
 * supplied by the canonical GenerationRequest rather than hard-coded here.
 */
export async function createDirectorGenerationRuntimeConfig(
  config: DirectorGenerationFactoryConfig = {
    comfyUi: defaultComfyUiConfig(),
    approvedLoras: defaultApprovedLoras(),
  },
): Promise<DirectorGenerationProviderRuntime> {
  const registry = new GenerationRegistry();
  const providers = new Map<string, GenerationProvider>();
  const comfyUi = config.comfyUi;
  const deployment = config.artifactDeployment;

  if (!deployment) {
    throw new Error('DIRECTOR_ARTIFACT_DEPLOYMENT_PROOF_REQUIRED');
  }
  const artifactDeployment = await enforceArtifactDeployment(
    deployment.ledger,
    deployment.requirement,
    deployment.verifiedAt ?? new Date().toISOString(),
  );
  if (deployment.requirement.subsystem !== 'director') {
    throw new Error('DIRECTOR_ARTIFACT_DEPLOYMENT_SUBSYSTEM_MISMATCH');
  }
  if (
    deployment.requirement.artifactId !==
    'comfyui:runtime-model-bundle'
  ) {
    throw new Error('DIRECTOR_COMFYUI_MODEL_BUNDLE_PROOF_REQUIRED');
  }

  if (!comfyUi) {
    throw new Error('DIRECTOR_GENERATION_PROVIDER_NOT_CONFIGURED');
  }

  const descriptor = buildComfyUiDescriptor(comfyUi);
  const client = createComfyUIHttpClient({
    baseUrl: comfyUi.baseUrl,
    ...(comfyUi.apiKey ? { headers: { authorization: `Bearer ${comfyUi.apiKey}` } } : {}),
  });
  const provider = new ComfyUIProvider(descriptor, client, buildWorkflow);
  providers.set(descriptor.id, provider);
  registry.registerProvider(descriptor);

  for (const model of comfyUi.models) {
    if (model.providerId !== descriptor.id) {
      throw new Error(`DIRECTOR_MODEL_PROVIDER_MISMATCH:${model.id}`);
    }
    registry.registerModel(model);
  }

  for (const lora of config.approvedLoras ?? []) {
    const approvalErrors = validateApprovedCharacterLoraRecord(lora);
    if (approvalErrors.length) {
      throw new Error(`DIRECTOR_APPROVED_LORA_INVALID:${lora.id}:${approvalErrors.join(',')}`);
    }
    const compatibleModel = registry.listModels().some((model) =>
      Boolean(model.baseModel) &&
      model.baseModel === lora.baseModel &&
      lora.modalities.some((modality) => model.modalities.includes(modality))
    );
    if (!compatibleModel) {
      throw new Error(`DIRECTOR_APPROVED_LORA_BASE_MODEL_UNAVAILABLE:${lora.id}`);
    }
    registry.registerLoRA(lora);
  }

  return { registry, providers, artifactDeployment };
}

/** Canonical provider-only factory used by reconciliation workers. */
export async function createDirectorGenerationProviders(
  config?: DirectorGenerationFactoryConfig,
): Promise<Map<string, GenerationProvider>> {
  return (await createDirectorGenerationRuntimeConfig(config)).providers;
}

/** Canonical registry + provider factory used by request handlers. */
export async function createDirectorGenerationRegistryAndProviders(
  config?: DirectorGenerationFactoryConfig,
): Promise<DirectorGenerationProviderRuntime> {
  return createDirectorGenerationRuntimeConfig(config);
}
