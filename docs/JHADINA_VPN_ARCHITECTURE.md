# Jhadina VPN architecture — provider boundary

## Purpose

The shell-level VPN switch should feel like one simple Jhadina control while the
actual tunnel lifecycle remains owned by a native, security-sensitive layer.

The browser and Ask Jhadina may receive only narrow state:

- disconnected / connecting / connected / error;
- profile ID;
- coarse location label;
- last non-secret error.

They must never receive private keys, raw WireGuard/OpenVPN/Xray configs,
provider API secrets, cloud credentials, or certificate material.

## External architecture references

### Trail of Bits Algo

Reference: https://github.com/trailofbits/algo

Useful pattern: personal/self-hosted VPN server provisioning with conservative
defaults, WireGuard + IKEv2 support, per-device configuration, minimal logging,
and multi-cloud deployment.

Jhadina use: treat this as a **server provisioning pattern**, not a client
library. A future Homebase/private-cloud worker can provision or rotate a
personal endpoint and then deliver an opaque profile reference to the native
device adapter.

License: AGPL-3.0. Do not copy Algo implementation code into proprietary Jhadina
modules without an explicit licensing decision. Current integration is
architecture/reference only.

### Amnezia Client

Reference: https://github.com/amnezia-vpn/amnezia-client

Useful pattern: desktop/mobile native VPN client separation, multi-protocol
support, native daemon/platform boundaries, self-hosted server workflows, and
real tunnel-state UX.

Jhadina use: treat this as a **native client/tunnel orchestration reference**.
Jhadina's current iOS/Android/Xray adapters already follow the correct boundary:
the native layer owns tunnel configuration and secrets, while the UI sees only
a narrow state bridge.

License: GPL-3.0. Do not copy Amnezia client implementation code into Jhadina
without an explicit licensing decision. Current integration is
architecture/reference only.

## Target stack

1. **Jhadina shell**
   - persistent VPN ON/OFF control;
   - real state only;
   - opens Privacy for detailed policy.

2. **privacy-core**
   - provider-neutral state model;
   - kill-switch policy;
   - native adapter contracts;
   - provider capability metadata.

3. **native device bridge**
   - iOS NetworkExtension / Android VpnService ownership;
   - tunnel state reporting;
   - profile selection;
   - connect/disconnect;
   - secret storage outside AI/browser context.

4. **optional personal VPN provisioner**
   - Algo-style self-hosted WireGuard/IKEv2 deployment;
   - cloud/homebase execution with explicit owner authorization;
   - emits opaque profile references, never credentials into the LLM layer.

5. **optional multi-protocol client/provider**
   - Amnezia-style support for difficult-network environments;
   - WireGuard first for ordinary use;
   - OpenVPN/Xray/Shadowsocks only when the native/provider policy selects them.

## UX truthfulness rule

If no native bridge is present (for example ordinary desktop/mobile browser
execution), Jhadina must show VPN setup/unavailable rather than simulate a
connected tunnel. The current UX-LIVE branch follows this rule.
