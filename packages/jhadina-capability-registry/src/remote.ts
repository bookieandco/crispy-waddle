export type RemoteTransportKind = 'ir' | 'wifi' | 'bluetooth' | 'mqtt' | 'vendor-api';

export type RemoteCapability =
  | 'remote.power' | 'remote.volume.up' | 'remote.volume.down'
  | 'remote.channel.up' | 'remote.channel.down'
  | 'remote.navigation.up' | 'remote.navigation.down' | 'remote.navigation.left'
  | 'remote.navigation.right' | 'remote.navigation.select' | 'remote.navigation.back'
  | 'remote.navigation.home' | 'remote.media.play' | 'remote.media.pause'
  | 'remote.media.stop' | 'remote.media.previous' | 'remote.media.next'
  | 'remote.media.rewind' | 'remote.media.fast_forward' | 'remote.input.select'
  | 'remote.menu.open' | 'remote.settings.open' | 'remote.keyboard.input'
  | 'remote.pointer.move' | 'remote.scene.execute';

export interface RemoteDevice {
  readonly id: string;
  readonly name: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly transports: readonly RemoteTransportKind[];
  readonly capabilities: readonly RemoteCapability[];
}

export interface RemoteCommand {
  readonly capability: RemoteCapability;
  readonly deviceId: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export interface CommandResult {
  readonly success: boolean;
  readonly capability: RemoteCapability;
  readonly deviceId: string;
  readonly transport?: RemoteTransportKind;
  readonly attempts: number;
  readonly latencyMs?: number;
  readonly error?: { readonly code: string; readonly message: string };
}

export interface RemoteTransport {
  readonly kind: RemoteTransportKind;
  readonly priority: number;
  supports(device: RemoteDevice, capability: RemoteCapability): boolean;
  execute(command: RemoteCommand): Promise<CommandResult>;
}

export class RemoteDeviceRegistry {
  private readonly devices = new Map<string, RemoteDevice>();

  register(device: RemoteDevice): void {
    if (!device.id.trim()) throw new Error('Device id is required');
    if (this.devices.has(device.id)) throw new Error(`Device already registered: ${device.id}`);
    this.devices.set(device.id, Object.freeze({ ...device }));
  }

  get(id: string): RemoteDevice | undefined { return this.devices.get(id); }
  has(id: string): boolean { return this.devices.has(id); }
}

export class RemoteTransportResolver {
  constructor(
    private readonly capabilities: { has(id: RemoteCapability): boolean },
    private readonly devices: RemoteDeviceRegistry,
    private readonly transports: readonly RemoteTransport[],
  ) {}

  resolve(command: RemoteCommand): readonly RemoteTransport[] {
    if (!this.capabilities.has(command.capability)) {
      throw new Error(`Unknown capability: ${command.capability}`);
    }
    const device = this.devices.get(command.deviceId);
    if (!device) throw new Error(`Unknown device: ${command.deviceId}`);
    return this.transports
      .filter(t => device.transports.includes(t.kind))
      .filter(t => t.supports(device, command.capability))
      .slice()
      .sort((a, b) => b.priority - a.priority || a.kind.localeCompare(b.kind));
  }
}
