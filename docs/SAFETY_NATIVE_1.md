# SAFETY-NATIVE.1

Status: implementation complete; physical-device receipts remain a later gate.

## What exists
Jhadina now has a reproducible iOS application target in the existing `apps/jhadina-ios` native boundary. The shell implements the native side of the Core Spine `SafetyNativeBridge` methods for capability discovery, location, capture-session admission, session termination, and device heartbeat.

The native runtime observes:
- microphone authorization
- camera authorization
- location authorization/current location
- network reachability
- battery state
- local encrypted-storage availability contract

The bridge is fail-closed. Capture admission is denied when the corresponding permission is unavailable. Background video is explicitly false.

## Existing native code
The pre-existing JhadinaAudio and JhadinaPacketTunnel code is preserved. Safety is an additional native concern, not a replacement for Privacy/VPN or audio output.

## CI
A macOS GitHub Actions workflow generates the Xcode project with XcodeGen, builds the iOS simulator target and runs the native unit tests.

## What SAFETY-NATIVE.1 does not claim
It does not claim physical-device permissions, background lifecycle behavior, reboot recovery, actual audio/video byte capture, App Store signing, or PROD-GATE.2 device receipts. Those require subsequent native phases and physical-device execution.

No simulated CI result may be promoted into a physical-device receipt.
