export interface LLMProviderConfig {
  id: string;
  displayName: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  timeoutMs?: number;
}

export interface LLMProviderConfigSource {
  get(id: string): LLMProviderConfig | undefined;
}

/** Reads provider configuration from an injected environment-like object. */
export class EnvironmentLLMProviderConfigSource implements LLMProviderConfigSource {
  constructor(private readonly env: Record<string, string | undefined>) {}

  get(id: string): LLMProviderConfig | undefined {
    const prefix = `JHADINA_LLM_${id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
    const baseUrl = this.env[`${prefix}_BASE_URL`];
    const model = this.env[`${prefix}_MODEL`];
    if (!baseUrl || !model) return undefined;

    return {
      id,
      displayName: this.env[`${prefix}_DISPLAY_NAME`] ?? id,
      baseUrl,
      apiKey: this.env[`${prefix}_API_KEY`],
      model,
      timeoutMs: this.env[`${prefix}_TIMEOUT_MS`]
        ? Number(this.env[`${prefix}_TIMEOUT_MS`])
        : undefined,
    };
  }
}
