import type { SafetyPlatformCapabilities, SafetyPlatform } from './safety-platform-capabilities.js';

export interface SafetyNativeBridge {
  readonly platform: Exclude<SafetyPlatform, 'web' | 'unknown'>;
  getCapabilities(): Promise<SafetyPlatformCapabilities>;
  readLocation(): Promise<Readonly<{ latitude: number; longitude: number; observedAt: string }> | null>;
  beginPermittedCapture(kinds: readonly ('audio' | 'video')[]): Promise<Readonly<{ sessionRef: string; startedAt: string }>>;
  endCapture(sessionRef: string): Promise<void>;
  getDeviceHeartbeat(): Promise<Readonly<{ observedAt: string; batteryPercent?: number; networkReachable: boolean }>>;
}

abstract class NativeSafetyAdapter {
  constructor(protected readonly bridge: SafetyNativeBridge, expectedPlatform: 'ios' | 'android') {
    if (bridge.platform !== expectedPlatform) throw new Error('Safety native bridge platform mismatch');
  }

  capabilities(): Promise<SafetyPlatformCapabilities> {
    return this.bridge.getCapabilities();
  }

  location(): ReturnType<SafetyNativeBridge['readLocation']> {
    return this.bridge.readLocation();
  }

  heartbeat(): ReturnType<SafetyNativeBridge['getDeviceHeartbeat']> {
    return this.bridge.getDeviceHeartbeat();
  }

  async startCapture(kinds: readonly ('audio' | 'video')[]): Promise<Readonly<{ sessionRef: string; startedAt: string }>> {
    const caps = await this.bridge.getCapabilities();
    if (kinds.includes('audio') && !caps.foregroundAudio && !caps.backgroundAudio) throw new Error('Audio capture unavailable');
    if (kinds.includes('video') && !caps.foregroundVideo && !caps.backgroundVideo) throw new Error('Video capture unavailable');
    return this.bridge.beginPermittedCapture(kinds);
  }

  stopCapture(sessionRef: string): Promise<void> {
    return this.bridge.endCapture(sessionRef);
  }
}

export class IosSafetyAdapter extends NativeSafetyAdapter {
  constructor(bridge: SafetyNativeBridge) { super(bridge, 'ios'); }
}

export class AndroidSafetyAdapter extends NativeSafetyAdapter {
  constructor(bridge: SafetyNativeBridge) { super(bridge, 'android'); }
}
