import type { ProviderRequest, ProviderResult, StudioProviderAdapter } from "./provider-adapters";
import { StudioProviderOrchestrator } from "./provider-orchestrator";

class UnavailableProvider implements StudioProviderAdapter {
  readonly kind = "lip-sync" as const;
  readonly name = "wav2lip-test-unavailable";
  async isAvailable(): Promise<boolean> { return false; }
  async execute(_request: ProviderRequest): Promise<ProviderResult> { throw new Error("should not execute"); }
}

class TestFallbackProvider implements StudioProviderAdapter {
  readonly kind = "lip-sync" as const;
  readonly name = "fallback-test";
  async isAvailable(): Promise<boolean> { return true; }
  async execute(request: ProviderRequest): Promise<ProviderResult> {
    return { provider: this.name, outputIds: [`fallback:${request.projectId}`], metadata: { metrics: { syncOffsetMs: 0, confidence: 0.5, durationMs: 0 } } };
  }
}

export async function verifyVoiceSyncFallback(): Promise<boolean> {
  const orchestrator = new StudioProviderOrchestrator([new UnavailableProvider(), new TestFallbackProvider()]);
  const result = await orchestrator.execute("lip-sync", { projectId: "fallback-test", inputIds: ["audio", "video"] });
  return result.selection.provider === "fallback-test" && result.selection.fallbackUsed === true;
}
