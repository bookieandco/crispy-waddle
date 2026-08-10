import type { BankAdapter } from './bank-adapter.js';
import type { CredentialResolver } from './credential-resolver.js';
import type { ProviderConfig } from './provider-health.js';

export type ProviderAdapterBuilder = (input: {
  provider: string;
  secret: string;
  config: ProviderConfig;
}) => BankAdapter;

export type ProviderAdapterFactoryOptions = {
  credentialResolver: CredentialResolver;
  configs: Readonly<Record<string, ProviderConfig>>;
  builders: Readonly<Record<string, ProviderAdapterBuilder>>;
};

/** Server-only adapter construction boundary. */
export class ProviderAdapterFactory {
  constructor(private readonly options: ProviderAdapterFactoryOptions) {}

  async create(provider: string): Promise<BankAdapter> {
    const config = this.options.configs[provider];
    if (!config) throw new Error(`PROVIDER_CONFIG_NOT_FOUND:${provider}`);
    if (!config.enabled) throw new Error(`PROVIDER_DISABLED:${provider}`);

    const builder = this.options.builders[provider];
    if (!builder) throw new Error(`PROVIDER_ADAPTER_NOT_REGISTERED:${provider}`);

    const credential = await this.options.credentialResolver.resolve(config.credentialRef);
    if (!credential.secret) throw new Error(`PROVIDER_SECRET_EMPTY:${provider}`);

    return builder({ provider, secret: credential.secret, config });
  }
}
