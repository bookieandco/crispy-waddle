import type { VpnState } from "./index";

export type KillSwitchMode = "off" | "always" | "untrusted-network";

export type NetworkTrust = "trusted" | "untrusted" | "unknown";

export interface KillSwitchPolicy {
  mode: KillSwitchMode;
}

export interface KillSwitchDecision {
  allowTraffic: boolean;
  reason: "disabled" | "vpn-connected" | "vpn-required" | "network-trusted" | "network-unknown";
}

/** Pure policy evaluation. It performs no networking and has no provider secrets. */
export function evaluateKillSwitch(
  policy: KillSwitchPolicy,
  vpn: Pick<VpnState, "status">,
  network: NetworkTrust,
): KillSwitchDecision {
  if (policy.mode === "off") return { allowTraffic: true, reason: "disabled" };
  if (vpn.status === "connected") return { allowTraffic: true, reason: "vpn-connected" };
  if (policy.mode === "always") return { allowTraffic: false, reason: "vpn-required" };
  if (network === "trusted") return { allowTraffic: true, reason: "network-trusted" };
  if (network === "unknown") return { allowTraffic: false, reason: "network-unknown" };
  return { allowTraffic: false, reason: "vpn-required" };
}

export const DEFAULT_KILL_SWITCH_POLICY: KillSwitchPolicy = {
  mode: "untrusted-network",
};
