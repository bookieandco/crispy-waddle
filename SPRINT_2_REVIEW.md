# Sprint 2 Pre-Implementation Architecture Review Report

**Date:** 2026-08-07  
**Version:** 1.0  
**Status:** COMPLETE  
**Approval Decision:** APPROVED WITH CHANGES

---

## Executive Summary

The Sprint 2 planning documents define a sound architecture and preserve the trust boundary correctly. However, **contract drift and scope creep** create implementation risk.

**Verdict:** NOT BLOCKED. Architecture is solid.

**Required:** Phase 0 Reconciliation (2-3 days) to align documentation before code begins.

---

## 1. Contract Consistency Review

### Finding: MISALIGNMENT ON VERSIONING, ENDPOINTS, AND DOMAIN MODELS

**API Versioning Conflict:**
- Backend contract endpoint inventory: unversioned (`/api/message`, `/api/candidates`)
- Backend contract versioning section: versioned (`/api/v1/*`)
- UX/Tasks documents: versioned (`/api/v1/*`)
- Current Sprint 1 code: unversioned

**Issue:** Three different conventions in four documents. Single version path required.

**Fix (Phase 0-1):** Commit to `/api/v1/*` across all documents.

---

**Domain Model Drift:**
- Contract proposes: `PROJECT`, `RELATIONSHIP`, `DECISION` memory types
- Sprint 1 supports: `PREFERENCE`, `IDENTITY`, `GOAL`, `CONTEXT`
- Memory model missing: `source`, `updatedAt`, `archivedAt` fields
- Candidate model missing: `reasoningEventId` link, status workflow

**Issue:** Contract extends beyond Sprint 1 without clear Sprint 2 boundary.

**Fix (Phase 0-1):** Keep Sprint 1 types. Add only fields needed for current workflow. Defer advanced types to Sprint 3.

---

**Error Response Format Conflict:**
- Current code: `{ error: string }`
- Backend contract: `{ success: false, error: {...} }`
- Tasks: `{ error, message, status, timestamp }`

**Issue:** Three formats across codebase and docs.

**Fix (Phase 0-1):** Standardize to:
```typescript
{
  success: false,
  error: {
    code: string,
    message: string
  },
  timestamp: string
}
```

---

**Missing Endpoints in Contract:**
- Backend contract covers: message, candidates, memories (list/search), approve/reject, health
- UX/Tasks require: dashboard, profile, preferences, memory history, memory edit, memory archive, timeline search

**Issue:** Contract incomplete for frontend needs.

**Fix (Phase 0-1):** Add endpoints for Sprint 2 features only. Defer export/delete to Sprint 3.

---

**Authentication Gap:**
- Contract requires: Token-derived identity, auth on every endpoint
- Sprint 1 uses: `x-user-id` header with fallback to `user_demo`
- Tasks reference: Auth middleware (not yet implemented)

**Issue:** Production auth not yet defined.

**Fix (Phase 0-1):** Document auth requirements. Implementation in Track A-2.

---

## 2. Database Alignment Review

### Finding: SCHEMA INCOMPLETE BUT FIXABLE

**Critical Gaps (All Required for Sprint 2):**

1. **No Memory Version History**
   - Requirement: Edit feature, history tracking
   - Fix: Add `memory_versions` table
   - Scope: Sprint 2

2. **No User Preferences**
   - Requirement: Settings screen
   - Fix: Add `user_preferences` table
   - Scope: Sprint 2

3. **Broken Approval Audit Chain**
   - Issue: DB lacks `reasoning_event_id` column on candidates
   - Fix: Add column + foreign key
   - Scope: Sprint 2

4. **Immutability Violations**
   - Issue: `ON DELETE CASCADE` destroys approval records
   - Fix: Change to `ON DELETE RESTRICT`
   - Scope: Sprint 2

5. **Missing Archive Columns**
   - Issue: No `archived_at` for soft deletes
   - Fix: Add columns to reasoning/timeline tables
   - Scope: Sprint 2

6. **Invalid PostgreSQL Syntax**
   - Issue: Inline INDEX declarations don't work
   - Fix: Convert to `CREATE INDEX` statements
   - Scope: Sprint 2

7. **Timeline Search Index**
   - Requirement: Full-text search needed
   - Fix: Add GIN index
   - Scope: Sprint 2

8. **User Provisioning Undefined**
   - Issue: FK fails if user doesn't exist
   - Fix: Define provisioning in auth middleware
   - Scope: Sprint 2 (Task A-2)

**Verdict:** Core schema sound. Issues are additions + corrections, not redesigns.

---

## 3. UX-API Alignment Review

### Finding: ALIGNMENT ACHIEVABLE WITH SCOPE CONTROL

#### Approval Center ✅ ALIGNED
- Workflow preserved: Observation → Candidate → Decision → Memory
- No changes needed

#### Memory Center ✅ ALIGNED (with Sprint 2 scope)
- Sprint 2: List, search, edit, archive, history
- Sprint 3: History UI editor, version comparison
- Fix: Add PUT/POST/GET endpoints

#### Timeline ✅ ALIGNED (with Sprint 2 scope)
- Sprint 2: List, filter, search
- Sprint 3: Advanced filtering, drill-down
- Fix: Add search endpoint

#### Dashboard ✅ ALIGNED (with Sprint 2 scope)
- Sprint 2: Pending count, recent memories, basic status
- Sprint 3: Analytics, trending
- Fix: Add dashboard endpoint

#### Settings ✅ ALIGNED (with Sprint 2 scope)
- Sprint 2: Profile, notification preferences
- Sprint 3: Export, delete, advanced privacy
- Fix: Add profile/preferences endpoints

#### System Health ✅ ALIGNED (with Sprint 2 scope)
- Sprint 2: Service status, version
- Sprint 3: Telemetry, resources, error log
- Fix: Define basic health response

**Screen States:** All must handle loading/empty/error/success/permission-denied.
- Fix: Update UX doc to show all states explicitly.

---

## 4. Implementation Sequence Review

### Finding: ORDER IS SOUND WITH PHASE 0 INSERTED

**Corrected Sequence:**
```
PHASE 0: Contract Reconciliation (2-3 days)
  ↓
TRACK A: Database Foundation + Auth Middleware
  ↓
TRACK B: Repository Implementation + Parity Tests
  ↓
TRACK C: API Integration
  ↓
TRACK D: Frontend Foundation
  ↓
TRACK E: Command Center Screens
  ↓
Integration Testing
  ↓
Deployment Validation
```

**Hidden Dependencies Found:**

1. **Contract Reconciliation must precede DB work**
   - Current: DB-1 starts immediately
   - Fix: Insert Phase 0 first

2. **Auth/User Provisioning must precede most API work**
   - Current: BACKEND-4 listed late
   - Fix: Move to Track A-2 (after schema)

3. **Transactions are unstated prerequisite**
   - Current: Not called out
   - Fix: Add to Track B-7

4. **Repository Parity Tests must run early**
   - Current: Testing is final phase
   - Fix: Move to Track B-final

5. **Scope must be locked before detailed tasks**
   - Current: Task doc enumerates everything
   - Fix: Document deferred features explicitly

---

## 5. Risk Assessment

### BLOCKING RISKS (Mitigated by Phase 0)

| Risk | Mitigation |
|------|-----------|
| API versioning conflict | Phase 0-1: Commit to `/api/v1/*` |
| Missing endpoints in contract | Phase 0-1: Add required Sprint 2 endpoints |
| User provisioning undefined | Task A-2: Define in auth middleware |
| Candidate-reasoning linkage broken | Phase 0-2: Add column to DB schema |
| Approval deletion via cascade | Phase 0-2: Change to `ON DELETE RESTRICT` |

### HIGH RISKS (Identified, Mitigated)

| Risk | Mitigation |
|------|-----------|
| Database migration breaks Sprint 1 | Track B: Parity tests validate compatibility |
| Auth falls back to demo user | Task A-2: Implement real auth middleware |
| Immutability rules unenforceable | Phase 0-2: Add `archived_at` columns, fix cascades |
| Memory version history unsupported | Phase 0-2: Add `memory_versions` table |
| Timeline search unimplemented | Phase 0-2: Add GIN index + search endpoint |

### SCOPE CREEP RISKS (Controlled)

| Feature | Sprint 2 | Sprint 3+ |
|---------|----------|----------|
| Profile editing | ✅ | - |
| Notification preferences | ✅ | - |
| Export/delete workflows | ❌ | ✅ |
| Memory edit | ✅ | - |
| Memory archive | ✅ | - |
| Memory history (basic) | ✅ | - |
| Memory history UI editor | ❌ | ✅ |
| Timeline search | ✅ | - |
| System health (basic) | ✅ | - |
| Telemetry/monitoring | ❌ | ✅ |

---

## 6. Cross-Document Contradictions

| Contradiction | Resolution |
|---|---|
| Versioning: `/api/*` vs `/api/v1/*` | Phase 0-1: Commit to `/api/v1/*` |
| Error format (3 versions) | Phase 0-1: Standardize one format |
| Domain models (conflicting types) | Phase 0-1: Keep Sprint 1 types only |
| Missing endpoints | Phase 0-1: Add Sprint 2 requirements |
| Health response shape | Phase 0-1: Define basic response |
| UI state completeness | Phase 0-3: Update all screens |
| Immutable audit rules | Phase 0-2: Fix schema constraints |

---

## 7. Final Approval Checklist

### Architecture ✅
- [x] No contradictions after reconciliation
- [x] Repository abstractions intact
- [x] Sprint 1 services not redesigned

### Data ✅
- [x] Every workflow has persistence path
- [x] Memory approval flow preserved
- [x] User isolation enforceable

### UX ✅
- [x] Every screen has backend dependencies
- [x] Every screen has all states
- [x] Approval Center is trust boundary

### Execution ✅
- [x] Tasks ordered by dependency
- [x] No frontend depends on unfinished backend
- [x] No hidden scope additions

---

## SPRINT 2 PRE-IMPLEMENTATION REVIEW RESULT

```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║          STATUS: APPROVED WITH CHANGES                         ║
║                                                                ║
║  Verdict: Architecture is sound. Documentation needs          ║
║           reconciliation. Scope requires definition.          ║
║                                                                ║
║  Implementation Approval: CONDITIONAL                          ║
║                                                                ║
║  Required Before Implementation:                              ║
║    Phase 0 — Contract Reconciliation (2-3 days)               ║
║                                                                ║
║  Implementation Start: NO                                     ║
║    (until Phase 0 complete + re-review approval)              ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

---

## Phase 0 — Contract Reconciliation

**Scope:** Documentation only. No code changes.

**Duration:** 2-3 days

**Deliverables:**

### Phase 0-1: Contract Alignment
**Update:** `BACKEND_CONTRACT.md`

**Changes:**
- [ ] Standardize all endpoints to `/api/v1/*` (not mixed `/api/*`)
- [ ] Standardize error response format across all endpoints
- [ ] Align domain models with Sprint 1 (keep 4 memory types)
- [ ] Add `source`, `updatedAt`, `archivedAt` to Memory model
- [ ] Add `reasoningEventId` to Candidate model
- [ ] Document missing endpoints for Sprint 2 only
- [ ] Defer advanced types (PROJECT/RELATIONSHIP/DECISION) to Sprint 3
- [ ] Remove premature automation/prediction/intelligence features from contract

---

### Phase 0-2: Database Design Correction
**Update:** `DATABASE_DESIGN.md`

**Changes:**
- [ ] Add `memory_versions` table
- [ ] Add `user_preferences` table
- [ ] Add `reasoning_event_id` column to `memory_candidates`
- [ ] Add `archived_at` columns to `reasoning_events`, `timeline_events`
- [ ] Fix `approvals.candidate_id` FK: change to `ON DELETE RESTRICT`
- [ ] Convert inline INDEX declarations to valid PostgreSQL `CREATE INDEX` statements
- [ ] Add GIN full-text search index on `timeline_events`
- [ ] Add GIN full-text search index on `memories`
- [ ] Document user provisioning requirement (to be implemented in Track A-2)
- [ ] Keep deferred items explicitly marked (Sprint 3+)

---

### Phase 0-3: UX Alignment
**Update:** `COMMAND_CENTER_UX.md`

**Changes:**
- [ ] Add loading state to all 6 screens
- [ ] Add empty state to all 6 screens
- [ ] Add error state to all 6 screens
- [ ] Map each screen to its required endpoints
- [ ] Clarify Approval Center workflow (unchanged)
- [ ] Mark deferred features (export/delete, telemetry, history editor) with "Sprint 3+" label
- [ ] Reduce System Health scope (status + services only, defer monitoring)
- [ ] Reduce Settings scope (profile + preferences only, defer export/delete)
- [ ] Add Notifications section (sound + alerts design)

---

### Phase 0-4: Task Plan Correction
**Update:** `SPRINT_2_TASKS.md`

**Changes:**
- [ ] Insert PHASE 0 (Contract Reconciliation) at top of task sequence
- [ ] Reorder Track A to include auth middleware (Task A-2)
- [ ] Add transaction layer to Track B (Task B-7)
- [ ] Move repository parity tests to Track B-final
- [ ] Clarify test tier definitions (Unit/Integration/E2E)
- [ ] Update success criteria with accurate endpoint count
- [ ] Mark all deferred features explicitly (Sprint 3+)
- [ ] Document hidden dependencies
- [ ] Add migration validation to Track A

---

### Phase 0-5: Create Scope Document (New)
**Create:** `SPRINT_2_SCOPE.md`

**Content:**
- [ ] List all Sprint 2 features (approved)
- [ ] List all Sprint 3+ features (deferred)
- [ ] Explain scope reduction rationale
- [ ] Provide Sprint 3 planning guidance

---

## Post-Phase 0

**After all Phase 0 deliverables are complete:**

1. Commit all changes to main branch
2. Request re-review of updated documents
3. Expected decision: **APPROVED (full)**
4. Then: Begin Track A — Database Foundation

---

## Summary

| Area | Status | Action |
|------|--------|--------|
| **Architecture** | ✅ SOUND | Proceed with Phase 0 |
| **Trust Boundary** | ✅ PRESERVED | No changes |
| **Contract** | ⚠️ DRIFTED | Phase 0-1: Align |
| **Database** | ⚠️ INCOMPLETE | Phase 0-2: Extend |
| **UX-API Alignment** | ⚠️ PARTIAL | Phase 0-3: Map |
| **Task Sequence** | ⚠️ HIDDEN DEPS | Phase 0-4: Reorder |
| **Scope** | ⚠️ CREEPING | Phase 0-5: Lock |

---

## Decision Summary

**This Review Recommends:**

✅ **DO NOT** start implementation yet  
✅ **DO** execute Phase 0 reconciliation  
✅ **DO** keep Phase 0 focused on documentation only  
✅ **DO** request re-review after Phase 0 completion  
✅ **DO** begin Track A only after re-review approval  

**Phase 0 is a cleanup pass, not a redesign.** The architecture is sound. Documentation needs alignment.

---

**SPRINT_2_REVIEW.md: COMPLETE AND READY FOR PHASE 0 EXECUTION**

**Next Steps:**

1. Commit SPRINT_2_REVIEW.md
2. Commit NOTIFICATION_DESIGN.md
3. Begin Phase 0 reconciliation of 4 documents + 1 new scope document
4. Re-run architecture review
5. Expect APPROVED result
6. Begin Track A — Database Foundation
