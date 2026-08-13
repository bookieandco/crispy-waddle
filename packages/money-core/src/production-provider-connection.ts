import { MoneyProviderHealthGate, type ProviderConfig, type ProviderHealth } from './provider-health.js';
import type { BankAdapter } from './bank-adapter.js';
import type { MoneyCapability } from './capabilities.js';
import type { MoneyProviderRegistry } from './provider-registry.js';

export type ProductionProviderConnectionOptions = {
  registry: MoneyProviderRegistry;
  config?: Readonly<Record<string, ProviderConfig>>;
};

/** Server-side provider boundary. Secrets are referenced, never passed through this object. */
export class ProductionProviderConnection {
  private readonly healthGate: MoneyProviderHealthGate;

  constructor(private readonly options: ProductionProviderConnectionOptions) {
    this.healthGate = new MoneyProviderHealthGate(options.config ?? {});
  }

  async getReadyProvider(provider: string, capability: MoneyCapability): Promise<BankAdapter> {
    const adapter = this.options.registry.get(provider);
    await this.healthGate.requireReady(adapter, capability);
    return adapter;
  }

  async check(provider: string, capability: MoneyCapability): Promise<ProviderHealth> {
    const adapter = this.options.registry.get(provider);
    return this.healthGate.check(adapter, capability);
  }
}
