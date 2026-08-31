import type { HomeAssistantDevice, HomeAssistantDeviceRegistry } from './home-assistant-device-registry.js';

export interface HomeAssistantRegistrationInput {
  readonly deviceId: string;
  readonly entityId: string;
  readonly baseUrl: string;
}

export function registerHomeAssistantDevice(
  registry: HomeAssistantDeviceRegistry,
  input: HomeAssistantRegistrationInput,
): HomeAssistantDevice {
  const device: HomeAssistantDevice = {
    deviceId: input.deviceId.trim(),
    entityId: input.entityId.trim(),
    baseUrl: input.baseUrl.trim().replace(/\/$/, ''),
  };
  registry.register(device);
  return device;
}
