export type VpnProviderKind = 'wireguard' | 'openvpn';
export type GatewayState = 'offline' | 'connecting' | 'connected' | 'degraded' | 'disconnecting' | 'error';

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
  constructor(private readonly provider: VpnProvider, private readonly policy: NetworkPolicy) {}
  async connect(profile: VpnProfile): Promise<VpnStatus> { await this.provider.connect(profile); return this.provider.status(); }
  async disconnect(): Promise<void> { await this.provider.disconnect(); }
  async status(): Promise<VpnStatus> { return this.provider.status(); }
  async authorize(request: NetworkAccessRequest, profile: VpnProfile): Promise<NetworkAccessDecision> {
    return this.policy.authorize(request, profile, await this.provider.status());
  }
}
