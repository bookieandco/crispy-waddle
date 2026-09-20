# SAFETY-PROD-GATE.4

SAFETY-PROD-GATE.4 is the executable boundary between DRILL and LIVE.

It builds on PROD-GATE.3 and adds:
- receipt freshness
- a required physical device identity
- evidence references on device receipts
- a durable admission ID
- admission expiry/revocation storage
- a mode-transition function that cannot enter LIVE without a successful gate receipt

The admission record is durable in Supabase and RLS-protected with no end-user policy. Production writes must travel through the governed server/action path.

## Current state

The gate is implemented but LIVE remains locked. This is intentional because the required physical iPhone, live provider, encrypted personal-profile and controlled-personal-drill receipts have not been produced.

A simulator, CI workflow, LLM judgment, GEV inference, manually set boolean, or database edit is not evidence of a successful physical safety drill.

## Native CI debt discovered

The SAFETY-NATIVE.1 simulator application build succeeds. The native unit-test action currently fails because Xcode's generated test host expects `JhadinaSafety.app/JhadinaSafety` while the product is named `Jhadina.app/Jhadina`. PROD-GATE.4 therefore does not treat native CI as satisfied until that mismatch is repaired and rerun.
