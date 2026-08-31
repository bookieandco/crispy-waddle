import type { HomeAssistantDevice, HomeAssistantDeviceRegistry } from './home-assistant-device-registry.js';
import type { HomeAssistantTransportBinding, HomeAssistantTransportRegistry } from './home-assistant-transport-registry.js';

export interface HomeAssistantRegistrationInput {
  readonly deviceId: string;
  readonly entityId: string;
  readonly baseUrl: string;
}

export function registerHomeAssistantDevice(
  registry: HomeAssistantDeviceRegistry,
  transports: HomeAssistantTransportRegistry,
  input: HomeAssistantRegistrationInput,
): HomeAssistantDevice {
  const device: HomeAssistantDevice = {
    deviceId: input.deviceId.trim(),
    entityId: `ha:entity:${input.entityId.trim().toLowerCase()}`,
  };
  const binding: HomeAssistantTransportBinding = {
    deviceId: device.deviceId,
    entityId: input.entityId.trim(),
    baseUrl: input.baseUrl.trim().replace(/\/$/, ''),
  };
  registry.register(device);
  transports.register(binding);
  return device;
}
