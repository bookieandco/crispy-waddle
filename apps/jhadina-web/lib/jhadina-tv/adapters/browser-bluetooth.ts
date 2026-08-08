import type { TVDevice, TVDeviceAdapter } from '../types';

/**
 * Web Bluetooth adapter boundary.
 *
 * Bluetooth support is intentionally capability-gated: browsers expose only
 * devices/services that the platform and TV make available. This adapter does
 * not assume Bluetooth can transport video; it is for discovery/control where
 * a compatible GATT profile exists.
 */
export class BrowserBluetoothAdapter implements TVDeviceAdapter {
  readonly protocol = 'bluetooth' as const;

  async discover(): Promise<TVDevice[]> {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) return [];
    // Actual requestDevice() must be initiated by a user gesture in browsers.
    return [];
  }

  async connect(deviceId: string): Promise<void> {
    if (!deviceId) throw new Error('Bluetooth device id is required');
  }

  async disconnect(deviceId: string): Promise<void> {
    if (!deviceId) throw new Error('Bluetooth device id is required');
  }

  async play(): Promise<void> {
    throw new Error('Bluetooth video playback requires a TV-specific control profile');
  }

  async pause(): Promise<void> {
    throw new Error('Bluetooth pause is unavailable without a compatible TV control profile');
  }

  async seek(): Promise<void> {
    throw new Error('Bluetooth seek is unavailable without a compatible TV control profile');
  }

  async setVolume(): Promise<void> {
    throw new Error('Bluetooth volume is unavailable without a compatible TV control profile');
  }
}
