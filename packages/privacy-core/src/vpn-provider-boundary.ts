/**
 * Jhadina VPN provider boundary.
 *
 * This is intentionally protocol/provider metadata only. Provider credentials,
 * private keys, generated tunnel configs, and provisioning secrets must remain
 * in the native/provider layer and never enter Ask Jhadina or browser state.
 *
 * Trail of Bits Algo (AGPL-3.0) and Amnezia Client (GPL-3.0) are architecture
 * references only. No source from either project is copied into this module.
 */
export type JhadinaVpnProtocol =
  | "wireguard"
  | "ikev2"
  | "openvpn"
  | "xray"
  | "shadowsocks"
  | "other";

export type JhadinaVpnProviderRole =
  | "server-provisioner"
  | "native-client"
  | "managed-provider";

export interface JhadinaVpnProviderCapabilities {
  id: string;
  label: string;
  role: JhadinaVpnProviderRole;
  protocols: JhadinaVpnProtocol[];
  selfHosted: boolean;
  canProvisionServers: boolean;
  canManageProfiles: boolean;
  canReportTunnelState: boolean;
  sourceReference?: string;
  sourceLicense?: string;
}

export const JHADINA_VPN_REFERENCE_CAPABILITIES: readonly JhadinaVpnProviderCapabilities[] = [
  {
    id: "algo-reference",
    label: "Algo-style personal VPN provisioning",
    role: "server-provisioner",
    protocols: ["wireguard", "ikev2"],
    selfHosted: true,
    canProvisionServers: true,
    canManageProfiles: true,
    canReportTunnelState: false,
    sourceReference: "trailofbits/algo",
    sourceLicense: "AGPL-3.0",
  },
  {
    id: "amnezia-reference",
    label: "Amnezia-style multi-protocol native client",
    role: "native-client",
    protocols: ["wireguard", "openvpn", "xray", "shadowsocks", "ikev2"],
    selfHosted: true,
    canProvisionServers: true,
    canManageProfiles: true,
    canReportTunnelState: true,
    sourceReference: "amnezia-vpn/amnezia-client",
    sourceLicense: "GPL-3.0",
  },
] as const;
