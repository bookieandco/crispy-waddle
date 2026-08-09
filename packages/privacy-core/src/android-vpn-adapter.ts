import type { VpnAdapter, VpnProfile, VpnState } from "./index";

/**
 * Platform bridge contract for Android. The implementation belongs in the
 * Android app/service and is responsible for Android VpnService + Xray.
 * No tunnel credentials or raw provider configuration cross this boundary.
 */
export interface AndroidVpnBridge {
  connect(profileId: string): Promise<void>;
  disconnect(): Promise<void>;
  getState(): Promise<VpnState>;
}

export class AndroidVpnAdapter implements VpnAdapter {
  constructor(private readonly bridge: AndroidVpnBridge) {}

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
