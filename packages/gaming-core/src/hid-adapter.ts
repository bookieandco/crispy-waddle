import type {
  CanonicalButton,
  CanonicalGameInput,
  ControllerAdapter,
  ControllerDevice,
} from './controller';

export interface HidSnapshot {
  device: ControllerDevice;
  buttons: Readonly<Record<string, boolean>>;
  leftStick?: { x: number; y: number };
  rightStick?: { x: number; y: number };
  timestamp?: string;
}

export interface HidTransport {
  discover(): Promise<HidSnapshot[]>;
  read(deviceId: string): Promise<HidSnapshot>;
}

const DEFAULT_MAPPING: Readonly<Record<string, CanonicalButton>> = {
  a: 'a', b: 'b', x: 'x', y: 'y',
  lb: 'l1', rb: 'r1', lt: 'l2', rt: 'r2',
  l3: 'l3', r3: 'r3',
  dpadUp: 'dpad_up', dpadDown: 'dpad_down',
  dpadLeft: 'dpad_left', dpadRight: 'dpad_right',
  start: 'start', select: 'select', home: 'home', menu: 'menu',
};

export class GenericHidControllerAdapter implements ControllerAdapter {
  readonly id = 'generic-hid';
  readonly name = 'Generic HID Controller';

  constructor(
    private readonly transport: HidTransport,
    private readonly mapping: Readonly<Record<string, CanonicalButton>> = DEFAULT_MAPPING,
  ) {}

  supports(device: ControllerDevice): boolean {
    return device.connection === 'hid' || device.connection === 'bluetooth' || device.connection === 'usb';
  }

  async discover(): Promise<ControllerDevice[]> {
    return (await this.transport.discover()).map(({ device }) => device);
  }

  async readInput(deviceId: string): Promise<CanonicalGameInput> {
    const snapshot = await this.transport.read(deviceId);
    const buttons = new Set<CanonicalButton>();
    for (const [raw, pressed] of Object.entries(snapshot.buttons)) {
      const canonical = this.mapping[raw];
      if (pressed && canonical) buttons.add(canonical);
    }

    return {
      buttons,
      leftStick: snapshot.leftStick ?? { x: 0, y: 0 },
      rightStick: snapshot.rightStick ?? { x: 0, y: 0 },
      timestamp: snapshot.timestamp ?? new Date().toISOString(),
    };
  }
}
