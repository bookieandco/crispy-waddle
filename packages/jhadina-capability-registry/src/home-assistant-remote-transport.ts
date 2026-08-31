import type { ResolvedRemoteCommand } from './remote-resolver.js';
import type { RemoteTransport } from './remote-transport.js';
import type { HomeAssistantDeviceRegistry } from './home-assistant-device-registry.js';

export interface HomeAssistantRemoteTransportConfig {
  readonly authToken: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

const POWER_CAPABILITY = 'remote.power';

export class HomeAssistantRemoteTransport implements RemoteTransport {
  readonly kind = 'home-assistant';

  constructor(
    private readonly config: HomeAssistantRemoteTransportConfig,
    private readonly devices: HomeAssistantDeviceRegistry,
  ) {}

  supports(command: ResolvedRemoteCommand): boolean {
    return command.capability === POWER_CAPABILITY && !!this.devices.get(command.deviceId);
  }

  async execute(command: ResolvedRemoteCommand): Promise<void> {
    if (!this.supports(command)) throw new Error('unsupported-or-unregistered-device');
    const device = this.devices.resolve(command);
    const fetchImpl = this.config.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 5000);
    try {
      const response = await fetchImpl(`${device.baseUrl.replace(/\/$/, '')}/api/services/homeassistant/toggle`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entity_id: device.entityId }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`home-assistant-http-${response.status}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
