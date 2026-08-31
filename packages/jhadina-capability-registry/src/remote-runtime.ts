import { CapabilityRegistry, registerRemoteCapabilities } from './index.js';
import { HomeAssistantDeviceRegistry } from './home-assistant-device-registry.js';
import { HomeAssistantRemoteTransport } from './home-assistant-remote-transport.js';
import { DeterministicRemoteResolver } from './remote-resolver.js';
import { TransportRouter } from './remote-transport.js';
import { ResolvedRemoteCommandExecutor } from './remote-execution.js';
import type { RemoteCommandPolicy } from './remote-command-gateway.js';

export interface RemoteRuntimeConfig {
  readonly homeAssistant?: {
    readonly authToken: string;
    readonly timeoutMs?: number;
  };
}

export function createRemoteRuntime(
  config: RemoteRuntimeConfig,
  policy: RemoteCommandPolicy,
) {
  const capabilities = new CapabilityRegistry();
  registerRemoteCapabilities(capabilities);
  const devices = new HomeAssistantDeviceRegistry();
  const transports = [] as HomeAssistantRemoteTransport[];

  if (config.homeAssistant) {
    transports.push(new HomeAssistantRemoteTransport(config.homeAssistant, devices));
  }

  const resolver = new DeterministicRemoteResolver(capabilities);
  const router = new TransportRouter(transports);
  const executor = new ResolvedRemoteCommandExecutor(capabilities, policy, resolver, router);

  return { capabilities, devices, transports, resolver, router, executor };
}
