export type CapabilityRisk = 'read' | 'write' | 'external' | 'financial' | 'destructive';

export interface CapabilityDefinition {
  readonly name: string;
  readonly description: string;
  readonly risk: CapabilityRisk;
  readonly version: number;
}

export class CapabilityRegistry {
  private readonly definitions = new Map<string, CapabilityDefinition>();

  register(definition: CapabilityDefinition): void {
    if (!definition.name.trim()) throw new Error('Capability name is required');
    if (!Number.isInteger(definition.version) || definition.version < 1) {
      throw new Error(`Invalid capability version: ${definition.name}`);
    }
    if (this.definitions.has(definition.name)) {
      throw new Error(`Capability already registered: ${definition.name}`);
    }
    this.definitions.set(definition.name, Object.freeze({ ...definition }));
  }

  get(name: string): CapabilityDefinition | undefined {
    return this.definitions.get(name);
  }

  has(name: string): boolean {
    return this.definitions.has(name);
  }

  list(): readonly CapabilityDefinition[] {
    return [...this.definitions.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}

export const REMOTE_CAPABILITY_DEFINITIONS: readonly CapabilityDefinition[] = [
  ['remote.power', 'Power control', 'write'],
  ['remote.volume.up', 'Increase volume', 'write'],
  ['remote.volume.down', 'Decrease volume', 'write'],
  ['remote.channel.up', 'Select next channel', 'write'],
  ['remote.channel.down', 'Select previous channel', 'write'],
  ['remote.navigation.up', 'Navigate up', 'write'],
  ['remote.navigation.down', 'Navigate down', 'write'],
  ['remote.navigation.left', 'Navigate left', 'write'],
  ['remote.navigation.right', 'Navigate right', 'write'],
  ['remote.navigation.select', 'Select focused item', 'write'],
  ['remote.navigation.back', 'Navigate back', 'write'],
  ['remote.navigation.home', 'Navigate home', 'write'],
  ['remote.media.play', 'Play media', 'write'],
  ['remote.media.pause', 'Pause media', 'write'],
  ['remote.media.stop', 'Stop media', 'write'],
  ['remote.media.previous', 'Previous media item', 'write'],
  ['remote.media.next', 'Next media item', 'write'],
  ['remote.media.rewind', 'Rewind media', 'write'],
  ['remote.media.fast_forward', 'Fast-forward media', 'write'],
  ['remote.input.select', 'Select an input', 'write'],
  ['remote.menu.open', 'Open device menu', 'write'],
  ['remote.settings.open', 'Open device settings', 'write'],
  ['remote.keyboard.input', 'Send keyboard input', 'write'],
  ['remote.pointer.move', 'Move pointer', 'write'],
  ['remote.scene.execute', 'Execute a registered remote scene', 'write'],
].map(([name, description, risk]) => Object.freeze({ name, description, risk: risk as CapabilityRisk, version: 1 }));

export function registerRemoteCapabilities(registry: CapabilityRegistry): void {
  for (const definition of REMOTE_CAPABILITY_DEFINITIONS) registry.register(definition);
}

export type {
  HomeAssistantAdapter,
  HomeAssistantEntityInput,
  HomeAssistantServiceInput,
  HomeAssistantEntityCapability as JhadinaEntityCapability,
  JhadinaEntityProvenance,
  JhadinaHomeEntity,
} from './home-assistant-adapter.js';
export { DeterministicHomeAssistantAdapter } from './home-assistant-adapter.js';
