export type ControllerConnection = 'bluetooth' | 'usb' | 'hid' | 'legacy' | 'virtual';

export type CanonicalButton =
  | 'a' | 'b' | 'x' | 'y' | 'l1' | 'r1' | 'l2' | 'r2' | 'l3' | 'r3'
  | 'dpad_up' | 'dpad_down' | 'dpad_left' | 'dpad_right'
  | 'start' | 'select' | 'home' | 'menu';

export interface AxisState { x: number; y: number; }
export interface CanonicalGameInput { buttons: ReadonlySet<CanonicalButton>; leftStick: AxisState; rightStick: AxisState; timestamp: string; }
export interface ControllerDevice { id: string; name: string; connection: ControllerConnection; vendorId?: number; productId?: number; batteryPercent?: number; }
export interface ControllerProfile { id: string; deviceId: string; name: string; mapping: Readonly<Record<string, CanonicalButton>>; deadzone?: number; }

export interface ControllerRepository {
  save(device: ControllerDevice): Promise<void>;
  get(deviceId: string): Promise<ControllerDevice | undefined>;
  saveProfile(profile: ControllerProfile): Promise<void>;
  getProfile(deviceId: string): Promise<ControllerProfile | undefined>;
}

export interface ControllerAdapter {
  id: string;
  name: string;
  supports(device: ControllerDevice): boolean;
  discover(): Promise<ControllerDevice[]>;
  readInput(deviceId: string): Promise<CanonicalGameInput>;
}

export class InMemoryControllerRepository implements ControllerRepository {
  private readonly devices = new Map<string, ControllerDevice>();
  private readonly profiles = new Map<string, ControllerProfile>();
  async save(device: ControllerDevice): Promise<void> { this.devices.set(device.id, Object.freeze({ ...device })); }
  async get(deviceId: string): Promise<ControllerDevice | undefined> { return this.devices.get(deviceId); }
  async saveProfile(profile: ControllerProfile): Promise<void> { this.profiles.set(profile.deviceId, Object.freeze({ ...profile })); }
  async getProfile(deviceId: string): Promise<ControllerProfile | undefined> { return this.profiles.get(deviceId); }
}

export class ControllerCore {
  constructor(private readonly repository: ControllerRepository, private readonly adapters: readonly ControllerAdapter[]) {}

  async discover(): Promise<ControllerDevice[]> {
    const devices = (await Promise.all(this.adapters.map((adapter) => adapter.discover()))).flat();
    for (const device of devices) await this.repository.save(device);
    return devices;
  }

  async input(deviceId: string): Promise<CanonicalGameInput> {
    const device = await this.repository.get(deviceId);
    if (!device) throw new Error(`Controller not registered: ${deviceId}`);
    const adapter = this.adapters.find((candidate) => candidate.supports(device));
    if (!adapter) throw new Error(`No controller adapter supports ${device.name}`);
    return adapter.readInput(deviceId);
  }

  async saveProfile(profile: ControllerProfile): Promise<void> {
    const device = await this.repository.get(profile.deviceId);
    if (!device) throw new Error(`Controller not registered: ${profile.deviceId}`);
    await this.repository.saveProfile(profile);
  }

  async profile(deviceId: string): Promise<ControllerProfile | undefined> {
    return this.repository.getProfile(deviceId);
  }
}
