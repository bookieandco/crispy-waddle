# SAFETY-PERSONAL.1 Readiness

This slice completes the source-level contracts from SAFETY-GEV.1 through SAFETY-PERSONAL.1 without placing personal secrets in source control.

## Implemented
- SAFETY-GEV.1 read-only SafetySpatialSnapshot boundary.
- SAFETY-GEV.2 timestamped incident timeline fusion.
- SAFETY-DMS.1 deterministic dead-man state machine.
- SAFETY-DMS.2 multi-signal liveness assessment with no action authority.
- SAFETY-DMS.3 escalation rules bound to scoped emergency pre-authorization.
- SAFETY-BLACKBOX.1 encrypted evidence references, integrity chain and off-device verification boundary.
- SAFETY-RUNTIME.1 platform capability declaration/fail-closed gate. No unsupported OS behavior is promised.
- SAFETY-CHAOS.1 failure matrix for connectivity, sensors, restart, corruption, provider outage and device disappearance.
- SAFETY-PERSONAL.1 private configuration schema/validator.

## Personal-data boundary
The repository stores IDs/references and validation rules only. Plaintext code words, contact phone numbers/email addresses, home/work addresses, secret confirmation phrases and encryption keys must live in an encrypted runtime secret/profile store, not Git.

## GEV boundary
GEV is read-only context. Safety configuration explicitly forbids named-person search, face recognition and plate identification. GEV evidence never authorizes a consequential action.

## Runtime truth
These contracts do not prove that iOS/Android background camera, microphone, location or network behavior is available. A platform adapter must advertise actual capabilities and fail closed when a capability is unavailable.

## Production gate
Before relying on the system for personal safety: run core-spine type-check/tests in CI; implement durable encrypted storage and key management; connect the existing governed communications runtime; test real OS permission/background behavior; test offline/restart/device-loss scenarios; then populate the owner's private profile outside source control.
