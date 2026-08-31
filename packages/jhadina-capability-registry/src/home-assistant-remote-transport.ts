import type { ResolvedRemoteCommand } from './remote-resolver.js';
import type { RemoteTransport } from './remote-transport.js';
import type { HomeAssistantTransportRegistry } from './home-assistant-transport-registry.js';

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
    private readonly transports: HomeAssistantTransportRegistry,
  ) {}

  supports(command: ResolvedRemoteCommand): boolean {
    return command.capability === POWER_CAPABILITY && !!this.transports.get(command.deviceId);
  }

  async execute(command: ResolvedRemoteCommand): Promise<void> {
    if (!this.supports(command)) throw new Error('unsupported-or-unregistered-device');
    const binding = this.transports.get(command.deviceId);
    if (!binding) throw new Error(`missing-transport-binding:${command.deviceId}`);
    const fetchImpl = this.config.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 5000);
    try {
      const response = await fetchImpl(`${binding.baseUrl}/api/services/homeassistant/toggle`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entity_id: binding.entityId }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`home-assistant-http-${response.status}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
