export type VpnProviderKind = 'wireguard' | 'openvpn';
export type GatewayState = 'offline' | 'connecting' | 'connected' | 'degraded' | 'disconnecting' | 'paused' | 'error';

export interface NetworkRoute { readonly cidr: string; readonly description?: string; }
export interface VpnProfile { readonly id: string; readonly name: string; readonly provider: VpnProviderKind; readonly endpoint: string; readonly routes: readonly NetworkRoute[]; readonly allowedNetworks: readonly string[]; readonly autoConnect: boolean; }
export interface VpnStatus { readonly state: GatewayState; readonly profileId?: string; readonly sessionId?: string; readonly errorCode?: string; }
export interface NetworkAccessRequest { readonly deviceId: string; readonly host: string; readonly port: number; readonly purpose: string; }
export interface NetworkAccessDecision { readonly allowed: boolean; readonly reason: string; }

export interface VpnProvider { readonly kind: VpnProviderKind; connect(profile: VpnProfile): Promise<void>; disconnect(): Promise<void>; status(): Promise<VpnStatus>; }
export interface CredentialStore { get(key: string): Promise<string>; set(key: string, secret: string): Promise<void>; delete(key: string): Promise<void>; }
export interface NetworkPolicy { authorize(request: NetworkAccessRequest, profile: VpnProfile, status: VpnStatus): NetworkAccessDecision; }

export class AllowlistedNetworkPolicy implements NetworkPolicy {
  authorize(request: NetworkAccessRequest, profile: VpnProfile, status: VpnStatus): NetworkAccessDecision {
    if (status.state !== 'connected') return { allowed: false, reason: 'VPN session is not connected' };
    if (!profile.allowedNetworks.some(cidr => request.host === cidr || request.host.startsWith(cidr.replace('/24', '.')))) return { allowed: false, reason: 'Destination is outside the authorized network' };
    return { allowed: true, reason: 'Destination is authorized by network policy' };
  }
}

export class PrivateNetworkGateway {
  private paused = false;
  private activeProfile?: VpnProfile;

  constructor(private readonly provider: VpnProvider, private readonly policy: NetworkPolicy) {}

  async connect(profile: VpnProfile): Promise<VpnStatus> {
    this.paused = false;
    this.activeProfile = profile;
    await this.provider.connect(profile);
    return this.provider.status();
  }

  async pause(): Promise<VpnStatus> {
    if (this.paused) return this.status();
    await this.provider.disconnect();
    this.paused = true;
    return { state: 'paused', profileId: this.activeProfile?.id };
  }

  async resume(): Promise<VpnStatus> {
    if (!this.paused) return this.status();
    if (!this.activeProfile) return { state: 'error', errorCode: 'NO_PROFILE_TO_RESUME' };
    this.paused = false;
    await this.provider.connect(this.activeProfile);
    return this.provider.status();
  }

  async toggle(): Promise<VpnStatus> {
    return this.paused ? this.resume() : this.pause();
  }

  async disconnect(): Promise<void> {
    this.paused = false;
    this.activeProfile = undefined;
    await this.provider.disconnect();
  }

  async status(): Promise<VpnStatus> {
    if (this.paused) return { state: 'paused', profileId: this.activeProfile?.id };
    return this.provider.status();
  }

  async authorize(request: NetworkAccessRequest, profile: VpnProfile): Promise<NetworkAccessDecision> {
    return this.policy.authorize(request, profile, await this.status());
  }
}
