# SAFETY-DRILL.2 through SAFETY-DRILL.3

## SAFETY-DRILL.2
The production safety schema has been applied to the connected Jhadina/SWLC Supabase project and verified empty before drill data. Runtime additions provide server-side dead-man leases and durable provider receipts.

A drill remains explicitly non-emergency: recipients must be allowlisted test/trusted contacts, external emergency services are disabled, and evidence release is disabled.

## SAFETY-MOBILE.2
The native bridge contract from the prior phase remains the device boundary. Real device permission/app-kill/reboot testing cannot be truthfully marked passed from CI alone; the production gate keeps this false until a physical-device drill supplies receipts.

## SAFETY-COMMS.2
Provider routing now has channel-specific idempotent attempts and durable receipt semantics. Real provider credentials and real recipients are intentionally not stored in Git.

## SAFETY-BLACKBOX.3
The vault policy requires a private store, encryption before upload, hash verification and no public URLs. Live object-store credentials remain runtime secrets.

## SAFETY-DMS.5
Server-side lease contracts plus the Supabase claim RPC allow due incidents to be claimed with SKIP LOCKED and lease expiry, preventing the handset from being the sole dead-man clock.

## SAFETY-CHAOS.3
The existing chaos harness remains the executable fault-injection layer. Physical device disappearance, power loss and OS process termination still require a device lab/manual drill to produce real evidence.

## SAFETY-PERSONAL.3
No real contacts, code words, addresses or confirmation secrets are committed. The encrypted personal-profile runtime is the only supported population path.

## SAFETY-DRILL.3
A controlled-personal-drill runner now requires:
- explicit drill mode
- allowlisted recipient
- no emergency-services contact
- no evidence release
- restart/recovery verification
- encrypted off-device evidence verification
- delivery receipt verification
- proof no unauthorized release occurred

## Production gate
Live emergency mode stays blocked until all of the following are evidenced: green Safety CI, migration applied, native-device drill, communications drill, vault drill, server dead-man drill, chaos drill, encrypted personal profile, and controlled personal drill.

This implementation deliberately does not mark physical-device/provider checks as passed without real receipts.
