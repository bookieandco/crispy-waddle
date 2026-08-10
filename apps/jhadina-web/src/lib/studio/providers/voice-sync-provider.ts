import type { ProviderRequest, ProviderResult, StudioProviderAdapter } from "../provider-adapters";

interface RuntimeResponse {
  outputId: string;
  metrics?: { syncOffsetMs?: number; confidence?: number; durationMs?: number };
}

export class VoiceSyncProvider implements StudioProviderAdapter {
  readonly kind = "lip-sync" as const;
  readonly name = "voice-sync-runtime";

  private readonly endpoint = process.env.JHADINA_VOICE_SYNC_URL;

  async isAvailable(): Promise<boolean> {
    return Boolean(this.endpoint);
  }

  async execute(request: ProviderRequest): Promise<ProviderResult> {
    if (!this.endpoint) throw new Error("JHADINA_VOICE_SYNC_URL is not configured");

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: request.projectId, inputIds: request.inputIds, parameters: request.parameters ?? {} }),
    });

    if (!response.ok) throw new Error(`Voice-sync runtime returned HTTP ${response.status}`);
    const result = (await response.json()) as RuntimeResponse;
    if (!result.outputId) throw new Error("Voice-sync runtime returned no outputId");

    return {
      provider: this.name,
      outputIds: [result.outputId],
      metadata: { status: "runtime-complete", metrics: result.metrics ?? {} },
    };
  }
}
