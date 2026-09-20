# Jhadina iOS Native Boundary

This directory is the native iOS execution boundary for Jhadina. Existing native modules remain intact:

- `JhadinaAudio` — native audio output bridge
- `JhadinaPacketTunnel` — privacy Network Extension boundary

## SAFETY-NATIVE.1

The Safety native shell adds:
- `Sources/JhadinaSafetyApp.swift` — minimal host UI/status surface
- `Sources/SafetyNativeBridge.swift` — iOS capability/location/network/battery bridge
- `Sources/SafetyBridgeEnvelope.swift` — typed request/response boundary matching the Core Spine bridge methods
- `project.yml` — reproducible XcodeGen project declaration
- `Tests/SafetyNativeRuntimeTests.swift` — bridge contract tests

The shell reports actual permission state and fails closed. It deliberately reports iOS background video as unavailable. It does not claim real capture bytes yet: actual AV capture is SAFETY-NATIVE.3.

### Generate the project

On a macOS/Xcode workstation:

```
brew install xcodegen
cd apps/jhadina-ios
xcodegen generate
open JhadinaSafety.xcodeproj
```

Apple signing/team selection and runtime secrets are intentionally not committed.

## Privacy / packet tunnel

The Network Extension implementation remains separate from Safety. Provider credentials/configuration belong in native secure storage and must not pass through the LLM or web UI. The packet-tunnel scaffold is not considered production VPN functionality until signed, entitled, built and tested on a physical iPhone.
