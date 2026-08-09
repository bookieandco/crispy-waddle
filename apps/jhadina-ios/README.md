# Jhadina iOS Privacy

This directory is the native iOS boundary for Jhadina Privacy.

## Targets

- `JhadinaIOS`: host iOS application
- `JhadinaPacketTunnel`: Network Extension target using `NEPacketTunnelProvider`

The native implementation is intentionally separate from the Next.js web app and the AI layer.

## Required Apple configuration

1. Create/open the Xcode project for these targets.
2. Enable the **Network Extensions** capability for the host and packet-tunnel targets as appropriate.
3. Add the Packet Tunnel Provider extension target.
4. Configure an App Group only if the host/extension bridge needs shared state.
5. Store provider credentials/configuration in native secure storage; never send them through Jhadina's LLM or web UI.
6. Replace the placeholder tunnel implementation with the selected VPN engine/provider integration.

This repository scaffold does not claim a working VPN until the Xcode target is signed, entitled, built, and tested on a physical iPhone.
