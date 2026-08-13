/**
 * Thin, provider-neutral lifecycle contract for Jhadina capabilities.
 *
 * Providers implement specialized capability behavior; ActionExecutor remains
 * the only execution boundary for user-authorized actions. This interface does
 * not grant providers direct access to policy, memory, secrets, or the ledger.
 */
export type ProviderStatus = "enabled" | "disabled" | "degraded" | "unavailable";

export type ProviderHealth = {
  status: ProviderStatus;
  checkedAt: string;
  latencyMs?: number;
  message?: string;
};

export type ProviderDescriptor = {
  id: string;
  name: string;
  version: string;
  capabilities: readonly string[];
  credentialRefs?: readonly string[];
};

export type ProviderAuthorization = {
  allowed: boolean;
  reason?: string;
};

export type ProviderExecutionContext = {
  requestId: string;
  userId: string;
  capability: string;
  metadata?: Record<string, unknown>;
};

export interface CapabilityProvider<TInput = unknown, TOutput = unknown> {
  readonly descriptor: ProviderDescriptor;

  configure?(config: Record<string, unknown>): Promise<void>;
  healthCheck(): Promise<ProviderHealth>;
  authorize?(context: ProviderExecutionContext): Promise<ProviderAuthorization>;
  execute(input: TInput, context: ProviderExecutionContext): Promise<TOutput>;
  disable?(): Promise<void>;
}

export function isProviderEnabled(health: ProviderHealth): boolean {
  return health.status === "enabled" || health.status === "degraded";
}
