# Sprint 2 Implementation Breakdown

**Version:** 1.0  
**Status:** PLANNING PHASE  
**Purpose:** Ordered task list with dependencies, acceptance criteria, and definition of done

---

## Overview

This document maps all Sprint 2 work into ordered, executable tasks.

**Three domains:**
- Backend (API, services, repositories)
- Database (schema, migrations)
- Frontend (screens, components, routing)

**Four quality gates:**
- Unit tests pass
- Integration tests pass
- Acceptance criteria met
- Definition of Done checklist complete

---

## Task Dependency Map

```
Database Schema (DB-1)
  ↓
Repositories Implementation (BACKEND-1)
  ↓
API Endpoints (BACKEND-2)
  ├→ Health Check (BACKEND-2.1)
  ├→ Dashboard (BACKEND-2.2)
  ├→ Memories (BACKEND-2.3)
  ├→ Candidates (BACKEND-2.4)
  ├→ Timeline (BACKEND-2.5)
  └→ Settings (BACKEND-2.6)
  ↓
Frontend Setup (FRONTEND-1)
  ├→ Mission Control (FRONTEND-2.1)
  ├→ Memory Center (FRONTEND-2.2)
  ├→ Approval Center (FRONTEND-2.3)
  ├→ Timeline (FRONTEND-2.4)
  ├→ System Health (FRONTEND-2.5)
  └→ Settings (FRONTEND-2.6)
  ↓
Integration Testing (TESTING-1)
  ↓
E2E Testing (TESTING-2)
  ↓
Sprint 2 Ready for Demo
```

---

## 1. Database Tasks

### DB-1: Schema Creation

**Purpose:** Create all persistent data tables matching DATABASE_DESIGN.md

**Tables to Create:**
1. users
2. memories
3. memory_candidates
4. approvals
5. reasoning_events
6. timeline_events
7. audit_logs

**Deliverable:** 
- SQL schema script
- All foreign keys
- All indexes
- Cascade delete rules

**Acceptance Criteria:**
- [ ] Schema matches DATABASE_DESIGN.md exactly
- [ ] All foreign keys created
- [ ] All indexes created
- [ ] Cascade delete behavior verified
- [ ] Schema validates against repository interfaces

**Definition of Done:**
- [ ] SQL schema script created
- [ ] Migration tested on clean database
- [ ] All constraints verified
- [ ] No warnings in schema validation
- [ ] User isolation enforced at schema level

---

## 2. Backend Tasks

### BACKEND-1: Repository Implementation

**Purpose:** Replace InMemory repositories with Postgres implementations

**Five Repositories to Implement:**
1. PostgresMemoryRepository
2. PostgresCandidateRepository
3. PostgresTimelineRepository
4. PostgresReasoningEventRepository
5. PostgresApprovalRepository

**Acceptance Criteria:**
- [ ] All repository methods implemented
- [ ] All methods include user_id WHERE clause
- [ ] Error handling implemented
- [ ] All Sprint 1 tests pass
- [ ] InMemory and Postgres repos behave identically

**Definition of Done:**
- [ ] Code review approved
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] No TODOs or FIXMEs
- [ ] TypeScript compiler passes

---

### BACKEND-2.1: Health Check Endpoint

**Endpoint:**
```
GET /api/v1/health
```

**Response:**
```typescript
{
  status: "ok" | "degraded" | "error",
  timestamp: string,
  services: {
    database: { status: string, responseTime: number },
    classifier: { status: string, lastClassification: string }
  },
  resources: {
    cpu: number,
    memory: number,
    storage: number
  },
  version: string
}
```

**Acceptance Criteria:**
- [ ] Returns correct status
- [ ] Checks database connectivity
- [ ] Returns resource usage
- [ ] Response time < 500ms

---

### BACKEND-2.2: Dashboard Endpoint

**Endpoint:**
```
GET /api/v1/dashboard
```

**Response:**
```typescript
{
  pendingCount: number,
  recentMemories: Memory[],
  recentActivity: { totalClassifications, totalApprovals, totalRejections },
  systemStatus: HealthStatus
}
```

**Acceptance Criteria:**
- [ ] Returns pending count
- [ ] Returns recent memories
- [ ] Returns activity summary
- [ ] Scoped to authenticated user
- [ ] Response time < 2s

---

### BACKEND-2.3: Memory Endpoints

**Endpoints:**
- GET /api/v1/memories (list, filter, paginate)
- GET /api/v1/memories/search (search by keyword)
- GET /api/v1/memories/{memoryId} (get single)
- PUT /api/v1/memories/{memoryId} (edit - creates candidate)
- POST /api/v1/memories/{memoryId}/archive (soft delete)
- GET /api/v1/memories/{memoryId}/history (view versions)

**Acceptance Criteria:**
- [ ] All endpoints implemented
- [ ] Filtering, sorting, pagination work
- [ ] User scoping enforced
- [ ] Edit creates candidate, not update
- [ ] Archive is soft delete only

---

### BACKEND-2.4: Candidate Endpoints

**Endpoints:**
- GET /api/v1/candidates (list pending)
- GET /api/v1/candidates/{candidateId} (get single)
- POST /api/v1/memory/approve (approve candidate → create memory)
- POST /api/v1/memory/reject (reject candidate)
- POST /api/v1/memory/modify (modify and create new candidate)

**Acceptance Criteria:**
- [ ] All endpoints implemented
- [ ] Approve creates memory
- [ ] Reject marks status
- [ ] Modify creates new candidate
- [ ] All audit trails created
- [ ] Timeline events created

---

### BACKEND-2.5: Timeline Endpoints

**Endpoints:**
- GET /api/v1/timeline (list with filtering)
- GET /api/v1/timeline/search (search events)

**Acceptance Criteria:**
- [ ] List with filtering works
- [ ] Search works
- [ ] Pagination works
- [ ] User scoping enforced

---

### BACKEND-2.6: Settings Endpoints

**Endpoints:**
- GET /api/v1/user/profile
- PUT /api/v1/user/profile
- GET /api/v1/user/preferences
- PUT /api/v1/user/preferences
- POST /api/v1/user/export
- POST /api/v1/user/delete

**Acceptance Criteria:**
- [ ] All endpoints implemented
- [ ] Profile update works
- [ ] Preferences persist
- [ ] Export includes all data
- [ ] Delete cascade works

---

### BACKEND-3: Error Handling

**All Endpoints Must Return Consistent Error Format:**

```typescript
// Success
{ data: T, status: number }

// Error
{
  error: string,
  message: string,
  status: number,
  timestamp: string
}
```

**Acceptance Criteria:**
- [ ] All error codes used correctly
- [ ] Error messages clear and non-technical
- [ ] All errors logged
- [ ] Consistent response format

---

### BACKEND-4: Authentication Middleware

**Purpose:** User scoping

**Must:**
- [ ] Extract user_id from auth token
- [ ] Add to request context
- [ ] Validate on every endpoint
- [ ] Reject if user_id missing

---

## 3. Frontend Tasks

### FRONTEND-1: Project Setup

**Purpose:** Initialize React frontend

**Deliverable:**
- React app with routing
- API client layer
- Component structure
- Styling system

**Acceptance Criteria:**
- [ ] App runs locally
- [ ] Routing works
- [ ] API client ready
- [ ] Build succeeds
- [ ] No console errors

---

### FRONTEND-2.1: Mission Control (Dashboard)

**Purpose:** User's starting point

**Features:**
- Display pending approvals
- Show recent memories
- Show activity stats
- Show system status

**States:**
- Loading
- Empty (no pending)
- With data
- Error

**Acceptance Criteria:**
- [ ] All components render
- [ ] Data loads from API
- [ ] Links work
- [ ] Responsive layout

---

### FRONTEND-2.2: Memory Center

**Purpose:** View and manage approved memories

**Features:**
- List approved memories
- Filter by type
- Search by keyword
- Sort by date/confidence
- Edit, archive, view history

**Acceptance Criteria:**
- [ ] All features work
- [ ] Pagination works
- [ ] Search works
- [ ] Filter works
- [ ] Edit creates candidate
- [ ] Archive hides memory

---

### FRONTEND-2.3: Approval Center

**Purpose:** Trust checkpoint for pending memories

**Features:**
- Display pending candidate
- Show evidence and confidence
- Approve, reject, modify
- Navigate queue

**Acceptance Criteria:**
- [ ] Candidate loads
- [ ] Approve works
- [ ] Reject works
- [ ] Modify works
- [ ] Evidence displays
- [ ] Progress shows

---

### FRONTEND-2.4: Timeline

**Purpose:** View system history

**Features:**
- List timeline events
- Filter by event type
- Search events
- Expand event details

**Acceptance Criteria:**
- [ ] Events display
- [ ] Filter works
- [ ] Search works
- [ ] Chronological order correct

---

### FRONTEND-2.5: System Health

**Purpose:** Show system status

**Features:**
- Overall status
- Service statuses
- Resource usage
- Error log
- Version info

**Acceptance Criteria:**
- [ ] Status displays
- [ ] Services show
- [ ] Resources show
- [ ] Errors show

---

### FRONTEND-2.6: Settings

**Purpose:** User control and data management

**Features:**
- Edit profile
- View memory counts
- Privacy settings
- Export data
- Delete account

**Acceptance Criteria:**
- [ ] Profile editable
- [ ] Preferences toggleable
- [ ] Export works
- [ ] Delete requires confirmation

---

### FRONTEND-3: Routing

**Routes:**
```
/              → Mission Control
/memories      → Memory Center
/approval      → Approval Center
/timeline      → Timeline
/health        → System Health
/settings      → Settings
/login         → Login
```

**Acceptance Criteria:**
- [ ] All routes work
- [ ] Auth check enforced
- [ ] Redirect on unauth

---

### FRONTEND-4: Styling and Theme

**Requirements:**
- [ ] Light theme
- [ ] Color palette defined
- [ ] Typography consistent
- [ ] Responsive on mobile
- [ ] Accessible color contrast (WCAG AA)

---

## 4. Testing Tasks

### TESTING-1: Unit Tests

**Coverage Target:** > 80%

**Scope:**
- All repositories
- All API endpoints
- All components

**Acceptance Criteria:**
- [ ] Tests written
- [ ] Coverage > target
- [ ] All tests passing
- [ ] No flaky tests

---

### TESTING-2: Integration Tests

**Scenarios:**
- Approve memory workflow
- Reject memory workflow
- Edit memory workflow
- Archive memory workflow
- User isolation
- Error handling
- Cascade delete

**Acceptance Criteria:**
- [ ] All workflows tested
- [ ] User isolation verified
- [ ] Errors handled
- [ ] All tests passing

---

### TESTING-3: E2E Tests

**User Journeys:**
1. First-time approval flow
2. Memory management flow
3. Settings flow

**Acceptance Criteria:**
- [ ] All journeys tested
- [ ] All user flows work
- [ ] No errors in happy path

---

## 5. Quality Gates

**Before merging any code:**
1. ✅ Passes unit tests
2. ✅ Passes integration tests
3. ✅ Code review approved
4. ✅ No TypeScript errors
5. ✅ No console errors/warnings
6. ✅ Accessibility verified
7. ✅ Performance verified

**Before Sprint 2 demo:**
1. ✅ All tasks complete
2. ✅ E2E tests passing
3. ✅ Zero known bugs
4. ✅ All acceptance criteria met
5. ✅ Documentation complete

---

## 6. Success Criteria

**Sprint 2 is successful when:**

✅ All 7 database tables created and tested  
✅ All 14 API endpoints working  
✅ All 6 screens built and functional  
✅ Complete user approval workflow working  
✅ User isolation enforced  
✅ Full audit trail created  
✅ Unit test coverage > 80%  
✅ Integration tests passing  
✅ E2E tests passing  
✅ Zero unhandled errors  
✅ Accessibility verified  
✅ Performance targets met  
✅ Documentation complete  
✅ Ready for user testing  

---

## 7. Implementation Order

**Week 1:**
- DB-1: Schema Creation
- BACKEND-1: Repositories
- BACKEND-2.1-2.6: API endpoints

**Week 2:**
- FRONTEND-1: Project setup
- FRONTEND-2.1-2.6: All screens
- FRONTEND-3-4: Routing and styling

**Week 3:**
- TESTING-1-3: All test suites
- Bug fixes
- Performance tuning

**Week 4:**
- Final review
- User testing prep
- Demo ready

---

**Status: SPRINT 2 PLANNING COMPLETE**

All four design documents locked and ready for implementation:
- ✅ BACKEND_CONTRACT.md
- ✅ DATABASE_DESIGN.md
- ✅ COMMAND_CENTER_UX.md
- ✅ SPRINT_2_TASKS.md

No implementation code written yet.

Ready for Sprint 2 kickoff.
