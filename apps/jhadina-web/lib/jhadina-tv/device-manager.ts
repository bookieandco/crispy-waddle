import type { TVDevice, TVDeviceAdapter, TVDeviceProtocol } from './types';

export class TVDeviceManager {
  private readonly adapters = new Map<TVDeviceProtocol, TVDeviceAdapter>();

  register(adapter: TVDeviceAdapter): void {
    this.adapters.set(adapter.protocol, adapter);
  }

  async discover(): Promise<TVDevice[]> {
    const results = await Promise.all(
      [...this.adapters.values()].map(async (adapter) => {
        try {
          return await adapter.discover();
        } catch {
          return [];
        }
      }),
    );

    return results.flat();
  }

  async connect(device: TVDevice): Promise<void> {
    const adapter = this.adapters.get(device.protocol);
    if (!adapter) throw new Error(`No adapter registered for ${device.protocol}`);
    await adapter.connect(device.id);
  }

  async disconnect(device: TVDevice): Promise<void> {
    const adapter = this.adapters.get(device.protocol);
    if (!adapter) throw new Error(`No adapter registered for ${device.protocol}`);
    await adapter.disconnect(device.id);
  }
}

export const tvDeviceManager = new TVDeviceManager();
