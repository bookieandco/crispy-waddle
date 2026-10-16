# TRUCKER-RECONCILE.03 — selective TruckerOS web forward-port
Date: 2026-10-16
- Source commit: crispy-waddle PR #1193 head 807117928c1242e6ac2710a7daffa210681c6eef. Exactly 104 preexisting app/core/docs blob objects reused; no private standalone TruckerOS source copied.
- Destination: fresh draft branch from monorepo main at 2df9aed86772265508d81580f6ceb34e73bc0bdd, preserving all newer main changes. The 542-commit stale historical branch was NOT force-merged.
- pnpm-lock.yaml: copied ONLY the two missing workspace importer records, using versions already resolved in the current main lock. Did not replace the current monorepo lock graph.
- Safe mode: legacy /api routes return 503 in NODE_ENV=production; community preview explicitly disabled there. Passing CI does NOT remove this gate.
- Backend: the local in-memory prototype is NOT a production tenant store. SQLite community requires Node >=22.16 and a persistent host; no commissioned database/backup/recovery.
- Router: FunFinder Haversine estimates and native-map handoff are not verified heavy-truck routes, parking rights, or legal truck access.
- Dispatcher: only user-entered manual/offline loads; does not fetch live freight, bind carriers, or book.
- Canonical private ledger/Dispatcher code stays in bookieandco/trucker-os; integration adapters must be reviewed without public duplication.
- Acceptance still needed: exact-head install/type-check/test/build, device GPS/permission tests, backend identity, independent encrypted restore and licensed-provider conditions.
