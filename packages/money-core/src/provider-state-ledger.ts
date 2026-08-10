export type ProviderState = {
  provider: string;
  enabled: boolean;
  credentialRef: string;
  capabilities: readonly string[];
  healthPolicy?: string;
  status?: 'unknown' | 'healthy' | 'unhealthy' | 'disabled';
  updatedAt: string;
};

export type ProviderStateVersion = ProviderState & {
  version: number;
  changedBy: string;
  actionId: string;
  reason: string;
  previousVersion?: number;
};

/** Append-only in-memory model used by the governed provider-state boundary.
 * Production persistence can be backed by the existing audit/database layer.
 * Secrets are intentionally represented only by credentialRef.
 */
export class ProviderStateLedger {
  private readonly history = new Map<string, ProviderStateVersion[]>();

  append(input: Omit<ProviderStateVersion, 'version' | 'previousVersion'>): ProviderStateVersion {
    const versions = this.history.get(input.provider) ?? [];
    const previous = versions.at(-1);
    const next: ProviderStateVersion = {
      ...input,
      version: (previous?.version ?? 0) + 1,
      previousVersion: previous?.version,
    };
    versions.push(next);
    this.history.set(input.provider, versions);
    return next;
  }

  current(provider: string): ProviderStateVersion | undefined {
    return this.history.get(provider)?.at(-1);
  }

  historyFor(provider: string): readonly ProviderStateVersion[] {
    return [...(this.history.get(provider) ?? [])];
  }

  restore(provider: string, version: number, changedBy: string, actionId: string, reason: string): ProviderStateVersion {
    const target = this.history.get(provider)?.find((entry) => entry.version === version);
    if (!target) throw new Error(`PROVIDER_STATE_VERSION_NOT_FOUND:${provider}:${version}`);

    return this.append({
      provider: target.provider,
      enabled: target.enabled,
      credentialRef: target.credentialRef,
      capabilities: target.capabilities,
      healthPolicy: target.healthPolicy,
      status: target.status,
      updatedAt: new Date().toISOString(),
      changedBy,
      actionId,
      reason,
    });
  }
}
