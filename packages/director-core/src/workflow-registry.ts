import type { GenerationProvider } from './generation-provider';
import type { GenerationRegistry } from './generation-registry';
import { validateWorkflowManifest, type GenerationWorkflowManifest } from './generation-manifest';

export class WorkflowRegistry {
  private readonly manifests = new Map<string, GenerationWorkflowManifest>();

  constructor(
    private readonly registry: GenerationRegistry,
    private readonly providers: Map<string, GenerationProvider> = new Map(),
  ) {}

  register(manifest: GenerationWorkflowManifest): void {
    validateWorkflowManifest(manifest);
    if (this.manifests.has(manifest.id)) {
      throw new Error(`Workflow already registered: ${manifest.id}`);
    }
    if (!this.registry.getProvider(manifest.providerId)) {
      throw new Error(`Workflow references unknown provider: ${manifest.providerId}`);
    }
    const provider = this.providers.get(manifest.providerId);
    if (provider && provider.descriptor.kind !== 'comfyui') {
      throw new Error(`ComfyUI workflow cannot target non-ComfyUI provider: ${manifest.providerId}`);
    }
    this.manifests.set(manifest.id, structuredClone(manifest));
  }

  get(id: string): GenerationWorkflowManifest | undefined {
    const manifest = this.manifests.get(id);
    return manifest ? structuredClone(manifest) : undefined;
  }

  list(): GenerationWorkflowManifest[] {
    return [...this.manifests.values()].map((manifest) => structuredClone(manifest));
  }

  compatibleWithProvider(providerId: string): GenerationWorkflowManifest[] {
    return this.list().filter((manifest) => manifest.providerId === providerId);
  }
}
