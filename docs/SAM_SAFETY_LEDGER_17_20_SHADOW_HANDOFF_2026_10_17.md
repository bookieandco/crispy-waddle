# SAM-SAFETY-LEDGER.17–.20 — stacked reconciliation and read-only shadow handoff

## .17 — GitHub and SWLC exact-state evidence (October 17, 2026)

- Current `main` verified as `dd2e773eb756c1bee65818704810267104856e15`.
- Draft PR #1336 `bac6f9c` depends on original `main` `e83a06d`; draft PR #1337 `739cf722` depends on #1336; draft PR #1342 `b944e134` depends on #1337; draft PR #1343 `c2ef9db` depends on #1342.
- Main advanced 55 commits beyond `e83a06d`. A GitHub compare found 72 touched file paths in those newer main commits and **zero identical-path overlaps** with the 27 SAM-stack paths at that stage. This is a *static filename comparison*, not proof of semantic merge/rebase correctness. No existing main work was discarded, no PR merged and no branch rebased.
- Supabase project `kqbkaozfjubkjevdfvic` control plane reports `ACTIVE_HEALTHY`; an actual read-only SQL probe failed `FATAL 57P03: database system is not accepting connections; Hot standby mode is disabled`. SWLC remains an external P0 blocker. Supabase Edge control plane lists `jhadina-sam-runtime-gateway` deployed at version 1; this does **not** prove the branch's newer `sam_safety_probe` route is deployed, or prove DB queries work.
- **No live SAM read or source feed certification succeeded.** Any reported `PASS` would be unsupported.

## .18 — real read-only shadow source checks

- `packages/opportunity-core/src/domain/sam-safety-shadow.ts` orchestrates all seven canonical source adapters without initiating external actions. It performs existing bounded receipt pagination, pinned Ed25519 witness verification and coverage reporting.
- Each source returns `verified_integrity_only` or `blocked`. Missing source, changed snapshot, untrusted signer or remote read errors remain blocked; no fallback to empty receipts.
- Even seven valid test fixture signatures yield `status:'blocked'`, unknown unauthorized-action/fallback counts, and four hardcoded denied authorities (outreach, bid, signature, payment).
- A separate manual shadow CLI first checks the existing OIDC SAM gateway contract **and then performs a real read-only SAM table SELECT**. Gateway health alone cannot mask the database outage.

## .19 — operator-controlled shadow launch, never live commissioning

- `.github/workflows/sam-safety-shadow.yml` uses `workflow_dispatch` only, with `refs/heads/main` and GitHub OIDC identity. No schedule, push, release or external action triggers.
- The opt-in `read_external_receipts` switch defaults `false`. Even if enabled, the runner rejects any missing or inconsistent **seven-source** roster; HTTPS fixed origins and paths are operator-provisioned, checkpoint reader must have a **different origin** than the receipt publisher, and public-key pins come from a separately controlled secret.
- GitHub variables: `SAM_SHADOW_FEEDS_JSON` with seven entries `{source,receiptOrigin,receiptPath,checkpointOrigin,checkpointPath,signerId}`; GitHub secret: `SAM_SHADOW_TRUSTED_KEYS_JSON` map keyed by source to `{signerId,publicKeyPem}`. These are **not currently verified as configured** and must not be created with made-up endpoints/keys.
- Remote readers only use HTTPS GET, no credentials, no redirects, no POST/PUT, no ingestion, no database writes. A valid-looking shadow report always causes a nonzero exit until independently commissioned and a separate safety attestation process exists. This job cannot confer authority by configuration.

## .20 — adversarial local/CI acceptance and remaining operator gates

- `sam-safety-shadow.test.ts`: all seven cryptographically valid fixture feeds still block production approval; missing six sources, missing trust key, wrong signer, failed transport, duplicate source, bad window and invalid time all block.
- `sam-safety-runtime.test.ts`: workflow dispatch only, exact main OIDC, read-only DB gate, disabled external reads by default, CLI always nonzero and no SAM enrichment/market bootstrap function calls.
- Opportunity Core exact-head CI is mandatory before review; broader repo checks are independent.
- Next ordered external closeout:
  1. Restore SWLC Postgres/REST without destructive repair; verify real SQL query and gateway exact deployed code/verified OIDC behavior.
  2. Obtain approved fixed-source receipt URLs and off-host signer pins independent of receipt publishers. Verify source completeness, blind spots and actor/tenant isolation by an external operator.
  3. Test a manual, read-only shadow **only on merged exact main**; do not enable outbound messages, bids, contract executions, payments or customer production access.
  4. Rebase and merge PR dependency chain only following human review, full exact-head CI, stale-main semantic inspection and source authentication checks. An independent production forensic safety certificate still has no implemented authority.
  
**Current outcome: source coding done; production and independent forensic certification BLOCKED.**
