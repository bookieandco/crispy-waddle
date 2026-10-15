# BIZ-PURSE.AUTOMATION.02 — Human-review board integration

**Status:** source-only, internal review. External integrations on [Supabase audit/repair #1276](https://github.com/bookieandco/crispy-waddle/issues/1276).

This bridges the existing `biz-purse-business-automation-playbook` to the existing `biz-purse-19-business-director` without granting outbound actions. Inputs come from the already-written draft-only lead scoring, qualified request, permission-aware 24h/3d/7d/14d/21d follow-up, onboarding first-week win, customer-support escalation, brand content review and daily financial review planner. The reviewer board can label tasks *waiting*, *draft retained*, *rejected*, or *escalated*. A "retained" label is a **local draft review only**, not an authorized email/SMS/DM or call.

The new module enforces owner and business identity, original Director and planner authority, task IDs, due dates, no execution capabilities, immutable-style exact replay of decision IDs, one decision per task, human reviewer references, owner emergency stop and deterministic evidence digests.

**Trust boundary:** A claimed reviewer ID/decision is not an authenticated user and never authorizes send, call, CRM access, publishing, money, purchases, API calls or auto-replies. Source receipts, authenticated approval persistence, consent and channel-specific opt-out/revocation must be independently commissioned before a real message goes out. Support, refunds and safety cases remain escalated for human review.

Tests: `pnpm --filter @jhadina/opportunity-core type-check` and `pnpm --filter @jhadina/opportunity-core test` (the new test is added to the package test command). Data originates in in-memory fixtures. No integration with Gmail, Instagram, Zapier, Atlas, n8n, QuickBooks, Stripe or Supabase is claimed or enabled. Marketing ROI and income claims from educational videos are not verified.
