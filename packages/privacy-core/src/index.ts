export type VpnStatus = "disconnected" | "connecting" | "connected" | "error";

export interface VpnProfile {
  id: string;
  name: string;
  provider: string;
  protocol: "xray" | "wireguard" | "openvpn" | "other";
  location?: string;
}

export interface VpnState {
  status: VpnStatus;
  profileId: string | null;
  location: string | null;
  lastError: string | null;
}

export interface VpnAdapter {
  connect(profile: VpnProfile): Promise<void>;
  disconnect(): Promise<void>;
  status(): Promise<VpnState>;
}

export function createVpnState(): VpnState {
  return { status: "disconnected", profileId: null, location: null, lastError: null };
}

/**
 * Narrow control surface for Jhadina. Credentials, raw configs, and provider
 * secrets remain inside the platform-specific adapter and never enter the AI layer.
 */
export class PrivacyController {
  constructor(private readonly adapter: VpnAdapter) {}

  async connect(profile: VpnProfile): Promise<VpnState> {
    await this.adapter.connect(profile);
    return this.adapter.status();
  }

  async disconnect(): Promise<VpnState> {
    await this.adapter.disconnect();
    return this.adapter.status();
  }

  async getStatus(): Promise<VpnState> {
    return this.adapter.status();
  }
}
