import type { ProviderRequest, ProviderResult, StudioProviderAdapter } from "../provider-adapters";

/**
 * Adapter for a separately deployed Wav2Lip inference service.
 * The model/checkpoints remain outside the Next.js process.
 * Configure JHADINA_WAV2LIP_URL server-side.
 */
export class Wav2LipProvider implements StudioProviderAdapter {
  readonly kind = "lip-sync" as const;
  readonly name = "wav2lip";

  async isAvailable(): Promise<boolean> {
    const url = process.env.JHADINA_WAV2LIP_URL;
    if (!url) return false;
    try {
      const response = await fetch(`${url.replace(/\/$/, "")}/health`, { method: "GET", cache: "no-store" });
      return response.ok;
    } catch {
      return false;
    }
  }

  async execute(request: ProviderRequest): Promise<ProviderResult> {
    const url = process.env.JHADINA_WAV2LIP_URL;
    if (!url) throw new Error("JHADINA_WAV2LIP_URL is not configured");

    const response = await fetch(`${url.replace(/\/$/, "")}/v1/lipsync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: request.projectId,
        inputIds: request.inputIds,
        parameters: request.parameters ?? {},
      }),
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Wav2Lip runtime returned HTTP ${response.status}`);

    const data = await response.json() as {
      outputId?: string;
      outputIds?: string[];
      metrics?: Record<string, unknown>;
    };
    const outputIds = data.outputIds ?? (data.outputId ? [data.outputId] : []);
    if (!outputIds.length) throw new Error("Wav2Lip runtime returned no output asset");

    return {
      provider: this.name,
      outputIds,
      metadata: { runtime: "wav2lip", ...data.metrics },
    };
  }
}
