import type { MediaItem, PlaybackState, TVDevice, TVDeviceAdapter, TVDeviceProtocol } from './types';

/** Protocol-independent TV device manager. Provider details stay behind adapters. */
export class TVDeviceManager {
  private readonly adapters = new Map<TVDeviceProtocol, TVDeviceAdapter>();
  private readonly states = new Map<string, PlaybackState>();

  register(adapter: TVDeviceAdapter): void {
    this.adapters.set(adapter.protocol, adapter);
  }

  async discover(): Promise<TVDevice[]> {
    const results = await Promise.all(
      [...this.adapters.values()].map(async (adapter) => {
        try { return await adapter.discover(); } catch { return []; }
      }),
    );
    return results.flat();
  }

  async connect(device: TVDevice): Promise<void> {
    const adapter = this.adapters.get(device.protocol);
    if (!adapter) throw new Error(`No adapter registered for ${device.protocol}`);
    await adapter.connect(device.id);
    this.updateState(device.id, { deviceId: device.id, status: 'idle', positionSeconds: 0 });
  }

  async disconnect(device: TVDevice): Promise<void> {
    const adapter = this.adapters.get(device.protocol);
    if (!adapter) throw new Error(`No adapter registered for ${device.protocol}`);
    await adapter.disconnect(device.id);
    this.updateState(device.id, { status: 'stopped' });
  }

  async play(device: TVDevice, media: MediaItem): Promise<void> {
    const adapter = this.adapters.get(device.protocol);
    if (!adapter) throw new Error(`No adapter registered for ${device.protocol}`);
    this.updateState(device.id, { deviceId: device.id, mediaId: media.id, status: 'connecting', positionSeconds: 0 });
    await adapter.play(device.id, media);
    this.updateState(device.id, { status: 'playing' });
  }

  async pause(device: TVDevice): Promise<void> {
    const adapter = this.adapters.get(device.protocol);
    if (!adapter) throw new Error(`No adapter registered for ${device.protocol}`);
    await adapter.pause(device.id);
    this.updateState(device.id, { status: 'paused' });
  }

  async seek(device: TVDevice, positionSeconds: number): Promise<void> {
    const adapter = this.adapters.get(device.protocol);
    if (!adapter) throw new Error(`No adapter registered for ${device.protocol}`);
    await adapter.seek(device.id, Math.max(0, positionSeconds));
    this.updateState(device.id, { positionSeconds: Math.max(0, positionSeconds) });
  }

  async setVolume(device: TVDevice, volume: number): Promise<void> {
    const adapter = this.adapters.get(device.protocol);
    if (!adapter) throw new Error(`No adapter registered for ${device.protocol}`);
    const normalized = Math.max(0, Math.min(1, volume));
    await adapter.setVolume(device.id, normalized);
    this.updateState(device.id, { volume: normalized });
  }

  getState(deviceId: string): PlaybackState | undefined {
    return this.states.get(deviceId);
  }

  private updateState(deviceId: string, patch: Partial<PlaybackState>): void {
    this.states.set(deviceId, {
      mediaId: undefined,
      deviceId,
      status: 'idle',
      positionSeconds: 0,
      ...this.states.get(deviceId),
      ...patch,
    });
  }
}

export const tvDeviceManager = new TVDeviceManager();
