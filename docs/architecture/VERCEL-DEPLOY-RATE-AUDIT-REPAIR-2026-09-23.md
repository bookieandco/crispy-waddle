# Vercel Deployment Rate AUDIT/REPAIR — 2026-09-23

Status: **AUDIT/REPAIR — source repair implemented, production gate still external until merged main deploys**

## Problem

The Jhadina Vercel project (`crispy-waddle-jhadina-web`) exhausted the account deployment/build-rate allowance. The current merged `main` therefore could not produce a fresh production deployment even though the application build and subsystem certification suites were green.

GitHub issue #519 remains the canonical external blocker.

## Evidence

Recent Vercel inventory shows repeated Git-sourced preview deployments for intermediate commits from feature branches, including the JHADINA-EXPRESSION.FINAL branch. Multiple commits produced separate READY/CANCELED preview deployments.

Repository configuration already contained the intended guard at the repository root:

```json
"git": {
  "deploymentEnabled": {
    "**": false,
    "main": true
  }
}
```

However, the Jhadina app-local config at `apps/jhadina-web/vercel.json` contained only the schema declaration. The observed Vercel behavior therefore did not enforce the repository-root guard for the Jhadina project.

## Repair

The app-local Vercel config now carries the same deployment guard:

- all automatic Git deployments disabled by default;
- `main` remains enabled for production lineage advancement.

A deterministic verifier was added at:

`apps/jhadina-web/scripts/verify-vercel-deployment-guard.mjs`

`Jhadina Web Deploy Conformance` runs that verifier before dependency installation/build, so root/app config drift fails CI.

## Expected effect

Feature-branch commits should stop consuming Vercel deployment quota. Pull-request CI still performs local/frozen production builds and targeted tests. Only `main` remains eligible for automatic Git deployment.

This deliberately does **not** weaken:

- frozen lockfile installation;
- production build checks;
- subsystem admission gates;
- authentication/evidence requirements;
- live-runtime certification requirements.

## Production admission

The repair is not a production PASS by itself.

After merge, production must still prove:

1. current `main` is accepted by Vercel after the rate window permits a build;
2. deployment reaches `READY`;
3. production alias points at the repaired/current lineage;
4. production runtime smoke tests pass;
5. blocked subsystem production certifications are re-run against that exact deployed lineage.

Until those receipts exist, affected production gates remain **BLOCKED_EXTERNAL**, not source failures.
