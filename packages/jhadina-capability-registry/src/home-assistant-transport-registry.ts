export interface HomeAssistantTransportBinding {
  readonly deviceId: string;
  readonly entityId: string;
  readonly baseUrl: string;
}

export class HomeAssistantTransportRegistry {
  private readonly bindings = new Map<string, HomeAssistantTransportBinding>();

  register(binding: HomeAssistantTransportBinding): void {
    if (!binding.deviceId.trim() || !binding.entityId.trim() || !binding.baseUrl.trim()) {
      throw new Error('invalid-home-assistant-transport-binding');
    }
    this.bindings.set(binding.deviceId, {
      ...binding,
      deviceId: binding.deviceId.trim(),
      entityId: binding.entityId.trim(),
      baseUrl: binding.baseUrl.trim().replace(/\/$/, ''),
    });
  }

  get(deviceId: string): HomeAssistantTransportBinding | undefined {
    return this.bindings.get(deviceId);
  }

  list(): readonly HomeAssistantTransportBinding[] {
    return [...this.bindings.values()].map(binding => ({ ...binding }));
  }
}
