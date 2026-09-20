# SAM-PROD.30–36 — Construction Pursuit Closeout

Date: 2026-09-20

## Reference adoption
Patterns were inspected from api-evangelist/sam.gov, MindPetal/sam-search, datadrivenconstruction/OpenConstructionERP, and microsoft/contractor. They are reference/adaptor inputs only; Opportunity Core remains canonical. No AGPL OpenConstructionERP source code is copied.

## SAM-PROD.30 — Construction Fulfillment Intelligence
PASS. Added construction requirement → BOQ/trade/resource projection with evidence references, confidence and unresolved-scope blockers. Inspired by BOQ/takeoff/cost/scheduling concepts, not a second ERP.

## SAM-PROD.31 — Subcontractor Operations
PASS. Added compliance and assignment contracts for insurance, licenses, capacity, milestones, deliverables, change orders and invoices. Compliance failures block readiness; domain state grants neither engagement nor payment authority.

## SAM-PROD.32 — Tender/Estimate Bridge
PASS. Evidence-backed accepted provider quotes roll into a construction tender model. Unpriced BOQ items remain explicit blockers. Pricing commitment and bid submission authority remain false.

## SAM-PROD.33 — Contractor Verification Agents
PASS. Added evidence-only verification findings for identity, registration, licenses, insurance, public records, past performance, capacity and contract clauses. Contradictions block; unknown/missing evidence requires review. Agent output cannot authorize engagement or contracting.

## SAM-PROD.34 — Contract Workspace
PASS BY FUSION. Existing versioned contract draft/redline, negotiation, reconciliation and digest-bound external execution receipt remain canonical. Construction/subcontract evidence feeds those contracts rather than creating a parallel legal authority model.

## SAM-PROD.35 — SAM Discovery Scheduler
PASS. Added budget-aware per-NAICS discovery batches, notice-ID dedupe semantics and incremental cursor support. This adopts MindPetal's useful scheduled/per-NAICS pattern while leaving outbound notifications and bid submission outside discovery authority.

## SAM-PROD.36 — Construction Pursuit Workspace / Acceptance
PASS. Added a canonical workspace projection connecting BOQ/trades, contractor verification, evidence-backed quote economics, blockers and human gates. Final acceptance requires at least three cases, persistence recovery, complete source evidence and zero unauthorized external actions.

## Terminal authority boundary
Research, decomposition, evidence gathering, ranking, BOQ/tender modeling, drafting and operator recommendations may be automated. Provider engagement requires governed authorization. Bid submission, contract signature/execution and payment remain separate human-governed capabilities.
