import type { VpnAdapter, VpnProfile, VpnState } from "./index";

/**
 * Platform bridge for an iOS NetworkExtension implementation.
 * The native target owns NEPacketTunnelProvider, credentials, and tunnel config.
 */
export interface IOSVpnBridge {
  connect(profileId: string): Promise<void>;
  disconnect(): Promise<void>;
  getState(): Promise<VpnState>;
}

export class IOSVpnAdapter implements VpnAdapter {
  constructor(private readonly bridge: IOSVpnBridge) {}

  async connect(profile: VpnProfile): Promise<void> {
    await this.bridge.connect(profile.id);
  }

  async disconnect(): Promise<void> {
    await this.bridge.disconnect();
  }

  async status(): Promise<VpnState> {
    return this.bridge.getState();
  }
}
