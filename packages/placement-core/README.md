# Placement Core

The first PlacementOS domain package. It contains framework-neutral contracts for the governed staffing transaction:

`job -> match -> consent -> referral -> placement -> assignment -> timesheet`

## Design rules

- Domain objects are independent of the web UI.
- Consent is checked before a referral is created.
- Placement policy is checked before a placement is created.
- Every consequential transition emits a domain event.
- Repositories own persistence; the domain service does not assume Supabase, Postgres, or a specific API layer.
- External job sources retain provenance through `JobOrder.source`.

## Next adapters

1. Supabase/Postgres repository and RLS policies.
2. Jhadina policy/action executor adapter.
3. Event bus / audit ledger adapter.
4. Worker Career Passport adapter.
5. Agency/employer Command Center API routes.
6. Contract and partner authorization checks.
