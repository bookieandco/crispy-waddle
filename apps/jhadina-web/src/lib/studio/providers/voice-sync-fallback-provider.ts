import type { ProviderRequest, ProviderResult, StudioProviderAdapter } from "../provider-adapters";

/**
 * Development/fallback adapter used to exercise provider selection and failover.
 * It is deliberately disabled in production unless explicitly enabled.
 */
export class VoiceSyncFallbackProvider implements StudioProviderAdapter {
  readonly kind = "lip-sync" as const;
  readonly name = "voice-sync-fallback";

  async isAvailable(): Promise<boolean> {
    return process.env.NODE_ENV !== "production" || process.env.JHADINA_ENABLE_VOICE_SYNC_FALLBACK === "true";
  }

  async execute(request: ProviderRequest): Promise<ProviderResult> {
    return {
      provider: this.name,
      outputIds: [`lip-sync-fallback:${request.projectId}:${Date.now()}`],
      metadata: { status: "fallback", metrics: { syncOffsetMs: 0, confidence: 0.5, durationMs: 0 } },
    };
  }
}
