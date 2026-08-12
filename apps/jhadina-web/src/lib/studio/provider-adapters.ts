export type ProviderKind = "lip-sync" | "qc" | "segmentation" | "rigging" | "animation" | "render";

export interface ProviderRequest { projectId: string; inputIds: string[]; parameters?: Record<string, unknown>; }
export interface ProviderResult { provider: string; outputIds: string[]; metadata?: Record<string, unknown>; }

export interface StudioProviderAdapter {
  readonly kind: ProviderKind;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  execute(request: ProviderRequest): Promise<ProviderResult>;
}

export class ProviderRegistry {
  private readonly providers = new Map<ProviderKind, StudioProviderAdapter[]>();

  register(provider: StudioProviderAdapter): void {
    const existing = this.providers.get(provider.kind) ?? [];
    this.providers.set(provider.kind, [...existing, provider]);
  }

  list(kind: ProviderKind): StudioProviderAdapter[] {
    return this.providers.get(kind) ?? [];
  }

  async choose(kind: ProviderKind): Promise<StudioProviderAdapter | undefined> {
    for (const provider of this.list(kind)) {
      if (await provider.isAvailable()) return provider;
    }
    return undefined;
  }
}
