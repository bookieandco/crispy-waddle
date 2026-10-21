# SOCIAL-CORE.RECOVER.06 — privileged approval/outbox cutover (source-only)

Date: 2026-10-21
Stacked on #1436 at `a1ab8ce0e06e2c14418eea8dff073310e541c7e9`.
Parent #1430 remains unmerged. Do **not** independently merge/promote this branch.
Source work only: NO production SQL migration, feature activation, Vercel promotion,
provider OAuth, post, message, ad expenditure, or Supabase modification.

## Verified live issue

An October 21 read-only Supabase inspection of Jhadina project
`kqbkaozfjubkjevdfvic` confirmed that `authenticated` could EXECUTE
19 direct publication/message/approval mutation RPCs, plus the legacy account
registration RPC. These are `SECURITY DEFINER` and independently reachable
through the Data API. Server-side Action Core policy alone cannot establish
policy enforcement if the same authenticated owner can directly issue or
consume receipt RPCs and manipulate outbox state.

Read-only `pg_get_functiondef('auth.uid()'::regprocedure)` shows
`auth.uid()` reads the current transaction's
`request.jwt.claim.sub` (or JWT claims sub). The cutover proposal uses this
existing contract in a protected, transactional wrapper. It does **not** claim
this has been tested under the live service-role/OIDC proxy.

## .06 implementation (uncommissioned)

- `apps/jhadina-web/src/lib/social/server-mutation-rpc.ts` is the only
  trusted write adapter for the 19 original Social operation names.
- It requires `JHADINA_SOCIAL_RPC_AUTHORITY_HARDENED=true`, independently
  checks verified Supabase session claims and exact requested owner, then
  requires a server-only service-role/OIDC privileged client.
- No generic arbitrary SQL, function name passthrough, or user-provided role.
  Any SQL/provider errors are redacted. **No mutation attempt is made** with
  the commissioning flag unset or the privileged client unavailable.
- `repository.ts`, `message-repository.ts`, and
  `supabase-approval-receipt-store.ts` route all original 19 mutation RPCs
  through the adapter. Owner-scoped reads continue through normal Supabase
  SSR/RLS. The separate verified account binding from #1430 stays intact.
- `supabase/proposals/social_core_recover_06_server_mutation_UNAPPLIED.sql`
  contains the static server dispatcher, SERVICE ROLE ONLY EXECUTE grant,
  and REVOKE statements for all 19 old client mutation RPCs plus account
  registration. No migration history entry has been written.
- Within one SQL transaction, the dispatcher sets the verified owner claim
  via `set_config(..., true)`, then delegates to one statically named original
  function, retaining its exact atomic receipt/idempotency constraints.
- The original functions retain `SECURITY DEFINER` until an independently
  proved conversion; server_role-only permission must be established
  immediately and atomically with activation. The dispatcher itself grants
  only `service_role` EXECUTE, never `PUBLIC`, `anon`, or `authenticated`.
- `scripts/social-rpc-authority-contract.py` asserts source/SQL parity,
  no remaining direct Social RPC writes in the three repositories, and the
  role restrictions. CI runs it before Social/Growth tests.
- `server-mutation-rpc.test.ts` covers flag-off, cross-owner rejection,
  unknown operation, missing privileged credentials, exact owner argument
  and redacted errors.

## Strict deployment / operator gates

1. Reconcile open PR #1430, #1436 and #.06 against current main; all exact-head
   checks must pass. These are intentionally stacked, not merged.
2. Compare applied Supabase migration ledger with source migration versions;
   neither old SQL proposals nor new one is a committed migration. Use the
   current Supabase CLI to create the unique migration filename and run on
   an isolated matching Postgres clone first.
3. Before altering production privileges, prove `authenticated`, `anon`,
   foreign owner and forged-profile requests cannot EXECUTE ANY of the 20
   forbidden mutation RPCs OR the new dispatcher. Assert `service_role`
   can access only the dispatcher and the original internally-required SQL
   functions where applicable. Role membership must not regrant access.
4. Prove transaction-local owner claim, service_role+OIDC bridge, correct
   user ID, handling of SQL exceptions, bad request fingerprints,
   wrong/expired/consumed approvals, cross-brand accounts, and double-submit
   under two owner sessions.
5. Prove a wrong/fresh owner receipt cannot attach to a different action,
   no publish or DM before exact server Action Core policy/consumption and
   no replay or duplicate idempotency under concurrent dispatch.
6. Prove message suppression, fresh eligibility, provider receipt/retry
   behavior and ambiguous post-send reconcile; avoid automatic retries that
   could create duplicate real-world posts/DMs.
7. Audit Action Core audit-ledger RPC write grants separately. The Social
   dispatcher does **not** grant approval or trust to an unverifiable audit
   event, and audit ledger write-authority deserves its own admission test.
8. Coordinate code deploy, SQL and `JHADINA_SOCIAL_RPC_AUTHORITY_HARDENED`
   flip with a rollback window. Flag is OFF by default and may remain OFF
   indefinitely. Before a full upgrade, all social writes now fail closed.
9. Obtain explicit approval before applying production migrations, enabling
   feature flags, connecting accounts or sending the first real post/DM.

## Source work vs. runtime proof

Passing TypeScript/CI is evidence of source integrity, not live Postgres
permission isolation, signed iPhone login, provider authorization, or
message delivery. The feature is therefore **not safe to commission** on
source results alone. Production remains unchanged.
