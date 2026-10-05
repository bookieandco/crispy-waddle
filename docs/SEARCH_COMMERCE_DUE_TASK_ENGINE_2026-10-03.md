# Search Commerce due-task engine — 2026-10-03

## Goal

Turn the canonical daily / weekly / monthly Search Commerce operating cadence into deterministic work that can be surfaced by Jhadina without granting new external authority.

## Inputs

The engine accepts:

- side-hustle family;
- business date;
- last completion date per routine;
- currently available evidence/input keys;
- optional storefront diagnostic.

## Due rules

- **Daily** routines are due when they have not been completed on the current business date.
- **Weekly** routines are due when they have not been completed in the same ISO week.
- **Monthly** routines are due when they have not been completed in the same calendar month.

The engine rejects future completion dates and invalid calendar dates.

## Evidence readiness

Each routine already declares its required inputs. The task engine compares those requirements with available evidence and exposes `missingInputs`.

A task can therefore be:

- due and ready;
- due but evidence-blocked;
- not due.

This is deliberately different from silently improvising missing data.

## Funnel-sensitive prioritization

The optional storefront diagnostic changes priority, not truth:

- no observed discovery -> listing inventory, market research, and operating planning become high priority;
- impressions without visits -> conversion experiments and shop audit become high priority;
- visits without orders -> conversion experiments, shop audit, and financial review become high priority;
- orders observed -> listing inventory, market research, and financial review become high priority.

These priorities tell Jhadina what to inspect first. They do not authorize marketplace changes.

## Authority boundary

The queue is planning-only. It cannot:

- publish or edit listings;
- run promotions or ads;
- message customers;
- purchase or fulfill orders;
- issue refunds;
- move money.

Those actions remain with their owning governed adapters and approval policies.
