import type { BankAdapter } from './bank-adapter.js';
import type { MoneyCapability } from './capabilities.js';

export type ProviderHealthStatus = 'READY' | 'UNCONFIGURED' | 'UNAVAILABLE' | 'CAPABILITY_DISABLED';

export type ProviderConfig = {
  enabled?: boolean;
  credentialRef?: string;
  capabilities?: readonly MoneyCapability[];
};

export type ProviderHealth = {
  provider: string;
  status: ProviderHealthStatus;
  checkedAt: string;
  reason?: string;
};

export type ProviderHealthChecker = (adapter: BankAdapter, config: ProviderConfig) => Promise<ProviderHealthStatus>;

const defaultChecker: ProviderHealthChecker = async (_adapter, config) => {
  if (config.enabled === false) return 'UNAVAILABLE';
  if (!config.credentialRef?.trim()) return 'UNCONFIGURED';
  return 'READY';
};

export class MoneyProviderHealthGate {
  constructor(
    private readonly config: Readonly<Record<string, ProviderConfig>> = {},
    private readonly checker: ProviderHealthChecker = defaultChecker,
  ) {}

  async check(adapter: BankAdapter, capability: MoneyCapability): Promise<ProviderHealth> {
    const config = this.config[adapter.provider] ?? {};
    const checkedAt = new Date().toISOString();

    if (config.capabilities && !config.capabilities.includes(capability)) {
      return { provider: adapter.provider, status: 'CAPABILITY_DISABLED', checkedAt, reason: capability };
    }

    const status = await this.checker(adapter, config);
    return { provider: adapter.provider, status, checkedAt };
  }

  async requireReady(adapter: BankAdapter, capability: MoneyCapability): Promise<void> {
    const health = await this.check(adapter, capability);
    if (health.status !== 'READY') {
      throw new Error(`BANK_PROVIDER_NOT_READY:${health.provider}:${health.status}`);
    }
  }
}
