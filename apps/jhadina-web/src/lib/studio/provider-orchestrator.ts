import type { ProviderKind, ProviderRequest, ProviderResult, StudioProviderAdapter } from "./provider-adapters";

export interface ProviderPolicy {
  preferred?: string[];
  allowFallback: boolean;
  requireHealthyProvider: boolean;
}

export interface ProviderSelection {
  kind: ProviderKind;
  provider: string;
  fallbackUsed: boolean;
}

export interface OrchestratedResult extends ProviderResult {
  selection: ProviderSelection;
}

export class StudioProviderOrchestrator {
  constructor(private readonly providers: StudioProviderAdapter[]) {}

  async execute(kind: ProviderKind, request: ProviderRequest, policy: ProviderPolicy = { allowFallback: true, requireHealthyProvider: true }): Promise<OrchestratedResult> {
    const candidates = this.providers.filter(p => p.kind === kind);
    const ordered = policy.preferred?.length
      ? [...candidates].sort((a, b) => (policy.preferred!.indexOf(a.name) + 1 || 999) - (policy.preferred!.indexOf(b.name) + 1 || 999))
      : candidates;

    let lastError: unknown;
    for (let index = 0; index < ordered.length; index++) {
      const provider = ordered[index];
      try {
        if (policy.requireHealthyProvider && !(await provider.isAvailable())) continue;
        const result = await provider.execute(request);
        return { ...result, selection: { kind, provider: provider.name, fallbackUsed: index > 0 } };
      } catch (error) {
        lastError = error;
        if (!policy.allowFallback) break;
      }
    }

    throw new Error(`No usable ${kind} provider is available${lastError ? `: ${String(lastError)}` : ""}`);
  }
}
