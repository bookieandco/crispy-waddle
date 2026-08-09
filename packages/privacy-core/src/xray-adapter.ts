import type { VpnAdapter, VpnProfile, VpnState } from "./index.js";

/**
 * Platform-neutral Xray/V2Ray adapter contract.
 * The Android implementation owns the actual VPN service, tunnel config,
 * credentials, and process lifecycle. This package never handles secrets.
 */
export interface XrayRuntime {
  connect(profileId: string): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<VpnState>;
}

export class XrayVpnAdapter implements VpnAdapter {
  constructor(private readonly runtime: XrayRuntime) {}

  async connect(profile: VpnProfile): Promise<void> {
    if (profile.protocol !== "xray") {
      throw new Error(`Unsupported protocol for Xray adapter: ${profile.protocol}`);
    }
    await this.runtime.connect(profile.id);
  }

  async disconnect(): Promise<void> {
    await this.runtime.disconnect();
  }

  async status(): Promise<VpnState> {
    return this.runtime.getStatus();
  }
}
