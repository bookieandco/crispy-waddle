import type { RemoteAccessProvider, RemoteProtocol } from './index.js';

export class RemoteAccessProviderRegistry {
  private readonly providers = new Map<RemoteProtocol, RemoteAccessProvider>();

  register(provider: RemoteAccessProvider): void {
    if (this.providers.has(provider.protocol)) {
      throw new Error(`Remote provider already registered: ${provider.protocol}`);
    }
    this.providers.set(provider.protocol, provider);
  }

  resolve(protocol: RemoteProtocol): RemoteAccessProvider {
    const provider = this.providers.get(protocol);
    if (!provider) throw new Error(`No remote provider registered: ${protocol}`);
    return provider;
  }

  has(protocol: RemoteProtocol): boolean {
    return this.providers.has(protocol);
  }

  list(): readonly RemoteProtocol[] {
    return [...this.providers.keys()].sort();
  }
}
