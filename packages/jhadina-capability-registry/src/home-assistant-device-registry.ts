import type { ResolvedRemoteCommand } from './remote-resolver.js';

export interface HomeAssistantDevice {
  readonly deviceId: string;
  readonly entityId: string;
  readonly baseUrl: string;
}

export class HomeAssistantDeviceRegistry {
  private readonly devices = new Map<string, HomeAssistantDevice>();

  register(device: HomeAssistantDevice): void {
    if (!device.deviceId.trim() || !device.entityId.trim() || !device.baseUrl.trim()) {
      throw new Error('invalid-home-assistant-device');
    }
    this.devices.set(device.deviceId, { ...device });
  }

  get(deviceId: string): HomeAssistantDevice | undefined {
    return this.devices.get(deviceId);
  }

  resolve(command: ResolvedRemoteCommand): HomeAssistantDevice {
    const device = this.get(command.deviceId);
    if (!device) throw new Error(`unknown-device:${command.deviceId}`);
    return device;
  }
}
