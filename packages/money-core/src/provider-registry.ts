import type { BankAdapter } from './bank-adapter.js';

export class MoneyProviderRegistry {
  private readonly adapters = new Map<string, BankAdapter>();

  register(adapter: BankAdapter) {
    if (!adapter.provider.trim()) throw new Error('BANK_PROVIDER_ID_REQUIRED');
    if (this.adapters.has(adapter.provider)) throw new Error(`BANK_PROVIDER_ALREADY_REGISTERED:${adapter.provider}`);
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: string) {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new Error(`BANK_PROVIDER_NOT_REGISTERED:${provider}`);
    return adapter;
  }

  list(): string[] { return [...this.adapters.keys()].sort(); }
}
