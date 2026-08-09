import type { VpnProfile, VpnState } from "./index";
import { PrivacyController } from "./index";
import { evaluateKillSwitch, type KillSwitchPolicy, type NetworkTrust } from "./kill-switch";

export type PrivacyAction =
  | { type: "vpn.connect"; profile: VpnProfile }
  | { type: "vpn.disconnect" }
  | { type: "vpn.status" }
  | { type: "privacy.evaluate-traffic"; network: NetworkTrust };

export interface PrivacyActionResult {
  state?: VpnState;
  allowTraffic?: boolean;
  reason?: string;
}

/**
 * Jhadina's narrow Privacy capability. The reasoning layer may request one of
 * these explicit actions; it cannot issue arbitrary native/network commands.
 */
export class JhadinaPrivacyCapability {
  constructor(
    private readonly controller: PrivacyController,
    private readonly killSwitch: () => KillSwitchPolicy,
  ) {}

  async execute(action: PrivacyAction): Promise<PrivacyActionResult> {
    switch (action.type) {
      case "vpn.connect":
        return { state: await this.controller.connect(action.profile) };
      case "vpn.disconnect":
        return { state: await this.controller.disconnect() };
      case "vpn.status":
        return { state: await this.controller.getStatus() };
      case "privacy.evaluate-traffic": {
        const state = await this.controller.getStatus();
        const decision = evaluateKillSwitch(this.killSwitch(), state, action.network);
        return { state, allowTraffic: decision.allowTraffic, reason: decision.reason };
      }
    }
  }
}
