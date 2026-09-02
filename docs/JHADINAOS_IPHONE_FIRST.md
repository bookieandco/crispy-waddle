# JhadinaOS — iPhone-first architecture

JhadinaOS is designed from day one as the user's primary personal-assistant environment on iPhone. It runs on top of iOS; it does not attempt to replace Apple's kernel, SpringBoard, or privileged system services.

## User experience

The native JhadinaOS shell is the front door:

- Home screen of first-party Jhadina apps
- `Ask Jhadina` as the primary command surface
- App Intents / Shortcuts for system invocation
- Notifications and widgets as future entry points
- Deep links into first-party apps

The target is to make Jhadina the assistant the user interacts with, while respecting iOS platform boundaries.

## OS layers

```text
iOS
  ↓
JhadinaOS native shell
  ↓
App Framework
  ├── App Manifest
  ├── App Registry
  ├── Lifecycle
  ├── Permissions
  └── App-to-App IPC
  ↓
Jhadina OS Services
  ├── Identity
  ├── Memory
  ├── Context
  ├── Notifications
  ├── Scheduler
  └── Audit
  ↓
Governance
  ├── Capability Registry
  ├── Authoritative ActionProposal
  ├── Policy Gate
  ├── Gateway
  └── Audit Ledger
  ↓
First-party apps
  ├── Media
  ├── Overage
  ├── Music
  ├── DirectorOS
  ├── Money
  ├── PupsonStuff
  ├── Social
  ├── Government
  ├── Files
  ├── Developer
  ├── Home
  └── Safety
```

## Non-negotiable rule

Voice, App Intents, UI buttons, automations, and app-to-app calls must enter the same governed Jhadina command path. No iPhone surface may bypass Identity → Capability Authorization → Authoritative ActionProposal → Policy Gate → Gateway → Audit.

## Current implementation

- `packages/jhadina-app-framework` defines first-class app manifests, registration, lifecycle states, permissions/capabilities, commands and events.
- `apps/jhadina-ios/JhadinaOS` contains the native SwiftUI shell and first-party app launcher.
- `AskJhadinaIntent` exposes the assistant through Apple's App Intents / Shortcuts framework.
- The iOS VPN/privacy scaffold remains separate from the AI/web layer; it is not treated as proof of a finished native product.

## Next implementation gates

1. Create/attach the real Xcode iOS application target to `apps/jhadina-ios/JhadinaOS`.
2. Add authenticated native → Jhadina command transport.
3. Make the command transport produce/consume the canonical governed proposal contract.
4. Add deep-link routing for every first-party app.
5. Add widgets and notification actions.
6. Replace placeholder app screens by mounting existing domain cores behind the App Framework.
7. Add physical-device testing and App Store signing configuration.
