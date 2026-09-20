# Jhadina iOS / JhadinaOS

The iPhone is a first-class JhadinaOS device. The native shell is the user's front door to Jhadina, while iOS remains the underlying operating system and security boundary.

## JhadinaOS targets

- `JhadinaOS`: native SwiftUI shell and first-party app launcher
- `JhadinaPacketTunnel`: Network Extension target for the separate privacy/VPN subsystem
- `JhadinaAudio`: native audio boundary

The native implementation remains separate from the Next.js web app and AI layer. The OS shell is responsible for app presentation and iOS integration; governed Jhadina services remain behind the OS command boundary.

## Siri replacement strategy

Jhadina cannot replace Apple's privileged Siri/system-assistant implementation. Instead, JhadinaOS exposes `AskJhadinaIntent` through App Intents / Shortcuts so the user can invoke Jhadina from supported iOS surfaces and route requests into the same governed command path used by the rest of Jhadina.

No voice or shortcut invocation is allowed to bypass Identity → Capability Authorization → Authoritative ActionProposal → Policy Gate → Gateway → Audit.

## Native setup

1. Create/open the Xcode project for the JhadinaOS host target.
2. Add the Swift sources under `JhadinaOS/` to the host target.
3. Enable App Intents/Shortcuts support.
4. Add the Network Extension capability only to the packet-tunnel target when the privacy subsystem is enabled.
5. Configure App Groups only where a native host/extension bridge actually requires shared state.
6. Keep provider credentials/configuration in native secure storage; never send them through an LLM or web UI.
7. Build and test on a physical iPhone before claiming native feature completion.

The current VPN scaffold does not claim a working VPN until the Xcode target is signed, entitled, built, and tested on a physical iPhone.
