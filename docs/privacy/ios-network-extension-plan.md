# Jhadina iOS Privacy — NetworkExtension Plan

## Reference architecture

The IVPN iOS project demonstrates a native Xcode app with separate tunnel-provider targets and support for WireGuard/V2Ray-related connectivity. Jhadina will use the architectural pattern, not copy IVPN source code.

## Jhadina target structure

```text
Jhadina iOS app
  ├── Privacy UI
  ├── JhadinaVPNManager
  │     └── NETunnelProviderManager
  └── Network Extension target
        └── JhadinaPacketTunnelProvider
```

## Responsibilities

### Main iOS app
- Present Jhadina Privacy UI.
- Request/install the VPN configuration through `NETunnelProviderManager`.
- Start/stop the tunnel.
- Observe `NEVPNConnection` state and expose it through the iOS bridge.
- Never expose tunnel secrets to the AI layer.

### Packet tunnel provider
- Implement `NEPacketTunnelProvider`.
- Start/stop the platform tunnel runtime.
- Apply packet tunnel network settings supplied by the approved profile.
- Report lifecycle failures to the manager.
- Keep credentials and provider-specific configuration inside the native extension.

## Shared boundary

The existing `IOSVpnAdapter` remains the only interface the Jhadina application layer needs:

- `connect(profileId)`
- `disconnect()`
- `getState()`

## Kill switch

The shared deterministic kill-switch policy remains authoritative for Jhadina decisions. iOS enforcement must be implemented using supported NetworkExtension/system capabilities; the web app must never claim that a kill switch is active until the native tunnel reports an enforced state.

## Reference notes

IVPN's public iOS repository contains an Xcode project, separate OpenVPN and WireGuard tunnel-provider targets, and documents V2Ray extension support. It is GPLv3. Jhadina should not copy GPL source into the proprietary/shared application unless licensing obligations are intentionally accepted.
