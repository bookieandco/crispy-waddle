import type { ProviderRequest, ProviderResult, StudioProviderAdapter } from "../provider-adapters";

export class VoiceSyncProvider implements StudioProviderAdapter {
  readonly kind = "lip-sync" as const;
  readonly name = "voice-sync-adapter";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async execute(request: ProviderRequest): Promise<ProviderResult> {
    return {
      provider: this.name,
      outputIds: [`lip-sync:${request.projectId}:${Date.now()}`],
      metadata: { status: "provider-ready", requiresModelRuntime: true },
    };
  }
}
