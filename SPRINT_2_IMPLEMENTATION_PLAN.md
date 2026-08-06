# Sprint 2 Implementation Plan

**Status:** 🚀 Planning / Ready for Implementation  
**Previous Sprint:** Sprint 1 (Core Backend Architecture & API Layer)  
**Next Sprint:** Sprint 3 (Intelligence Layer)

---

## 📋 Objective

Transform the completed backend architecture into a usable Jhadina application by connecting the UI layer, persistent storage, and user-facing workflows while preserving the existing architectural boundaries.

**Success Definition:**
A person can open Jhadina, talk to it, review what it learned, approve memories, close the application, reopen it, and all memories persist with full audit history intact.

---

## 🔐 Guardrails (Non-Negotiable)

These constraints apply to all work in Sprint 2:

```
❌ No autonomous actions
❌ No financial execution
❌ No external integrations
❌ No replacement of JanetService architecture
❌ No bypassing approval workflow
❌ No memory without user permission
❌ No cross-user data access
```

Every endpoint, component, and database query must enforce these rules.

---

## 🎯 Four Phases

### Phase A — Backend Contract

**Goal:** Formalize the API contract that frontend and backend will evolve together against.

**Deliverable:** `BACKEND_CONTRACT.md`

**Contents:**
- Complete API surface (all endpoints)
- Request/response schemas (TypeScript interfaces)
- HTTP status codes and error handling
- Authentication/user identity rules
- Frontend/backend responsibility boundaries
- Invariants that must never be violated

**Why This Phase First:**
The contract prevents the UI from accidentally becoming a backdoor into the system. Every frontend engineer and backend engineer works against the same source of truth.

**Files to Create:**
- `BACKEND_CONTRACT.md` - The frozen API contract

**Acceptance Criteria:**
- [ ] All 8 endpoints documented
- [ ] Request/response shapes are TypeScript-compliant
- [ ] Error codes and messages defined
- [ ] Authentication scoping rules explicit
- [ ] No ambiguity about who validates what
- [ ] Frontend and backend engineers agree

---

### Phase B — Persistence Layer

**Goal:** Design production-grade data storage that preserves business logic in the service layer.

**Deliverable:** `DATABASE_DESIGN.md`

**Contents:**
- PostgreSQL schema design
- Table relationships and foreign keys
- Indexes and query optimization strategy
- Migration plan from in-memory to persistent storage
- Data lifecycle (creation, updates, archival, deletion)
- Repository interface mapping (no changes to existing interfaces)

**Key Constraints:**
- Preserve repository interfaces (service layer unchanged)
- No business logic moves into database triggers or stored procedures
- No LLM dependency inside storage layer
- All queries must be scoped by user_id
- Audit trail must be immutable

**Why This Phase Second:**
The database must fit the existing architecture, not force architecture changes. Repositories already define the contract; we're just swapping the implementation.

**Files to Create:**
- `DATABASE_DESIGN.md` - Complete schema, migrations, and mapping strategy
- `prisma/schema.prisma` - Prisma schema definition
- `prisma/migrations/001_initial.sql` - Initial migration

**Acceptance Criteria:**
- [ ] Schema handles all data types from Sprint 1
- [ ] All 8 tables designed with proper relationships
- [ ] Indexes placed on query-critical fields
- [ ] Migration strategy preserves existing in-memory data during transition
- [ ] Repository interfaces remain 100% unchanged
- [ ] User isolation enforced at schema level
- [ ] Audit logs immutable

---

### Phase C — Command Center UX

**Goal:** Design the six-screen interface that users will use to interact with Jhadina.

**Deliverable:** `COMMAND_CENTER_UX.md`

**The Six Screens:**

1. **Mission Control** (Dashboard)
   - What does Jhadina know?
   - What needs attention?
   - Quick stats and health

2. **Memory Center** (Knowledge Base)
   - All approved memories
   - Organized by type
   - Searchable and filterable

3. **Approval Center** (The Heart)
   - Pending memory candidates
   - Review, approve, reject, or modify
   - Evidence-based decisions

4. **Timeline** (Audit Log)
   - Human-readable chronology
   - Every action recorded
   - Filterable by date/type

5. **System Health** (Operational)
   - Service status
   - Database connection
   - Error logs
   - Statistics

6. **Settings** (Configuration)
   - Memory preferences
   - Data export/import
   - Identity profile
   - Advanced options

**For Each Screen:**
- Clear purpose statement
- User actions available
- Required API calls
- Component architecture
- UI states (loading, error, empty, success)
- Data refresh strategies

**Why This Phase Third:**
UX design forces clarity about what data the backend must provide. It prevents feature creep and keeps scope locked to the contract.

**Files to Create:**
- `COMMAND_CENTER_UX.md` - Complete UX specification with wireframes and component breakdowns

**Acceptance Criteria:**
- [ ] All six screens documented
- [ ] User actions clearly defined
- [ ] API dependencies mapped (which calls each screen makes)
- [ ] Component hierarchy specified
- [ ] States (loading/error/empty) defined
- [ ] No styling yet—pure structure and function
- [ ] All actions respect approval workflow

---

### Phase D — Implementation Breakdown

**Goal:** Break the three previous phases into ordered, executable tasks with clear dependencies.

**Deliverable:** `SPRINT_2_TASKS.md`

**Structure:**
- Ordered task list
- Task dependencies (what must finish before what)
- Acceptance criteria for each task
- Testing requirements
- Estimated complexity
- Owner assignment (optional for this plan)

**Task Categories:**

**Backend Tasks (Implement Phase A contract):**
- Add authentication middleware
- Add user scoping to all endpoints
- Add error handling layer
- Validate all endpoints against contract

**Database Tasks (Implement Phase B schema):**
- Create Prisma schema
- Create migrations
- Update repositories for Postgres
- Test repository functionality

**Frontend Tasks (Implement Phase C UX):**
- Create API client library
- Build data fetching hooks
- Create the six screens
- Build shared components

**Integration Tasks:**
- Connect frontend to backend
- Test full workflows
- Validate user isolation
- Real-world testing

**Why This Phase Last:**
Only after contract, database, and UX are locked can implementation proceed without chaos.

**Files to Create:**
- `SPRINT_2_TASKS.md` - Complete task breakdown with dependencies

**Acceptance Criteria:**
- [ ] Tasks ordered by dependency
- [ ] Each task has clear acceptance criteria
- [ ] Each task has testing requirements
- [ ] No circular dependencies
- [ ] Total scope is realistic for one sprint
- [ ] All guardrails are checkpoints in tasks

---

## 📋 Document Checklist

Before marking Phase as Complete:

**Phase A — Backend Contract**
- [ ] `BACKEND_CONTRACT.md` created and committed
- [ ] All 8 endpoints documented
- [ ] Authentication rules explicit
- [ ] Error handling defined
- [ ] Team alignment confirmed

**Phase B — Persistence Layer**
- [ ] `DATABASE_DESIGN.md` created and committed
- [ ] Schema design complete
- [ ] Migration strategy clear
- [ ] Repository mapping verified
- [ ] No business logic in DB layer

**Phase C — Command Center UX**
- [ ] `COMMAND_CENTER_UX.md` created and committed
- [ ] All six screens specified
- [ ] API dependencies mapped
- [ ] Component architecture clear
- [ ] States and edge cases defined

**Phase D — Implementation Breakdown**
- [ ] `SPRINT_2_TASKS.md` created and committed
- [ ] Tasks ordered by dependency
- [ ] Acceptance criteria clear
- [ ] Testing strategy defined
- [ ] Guardrails are checkpoints

---

## 🚫 Guardrails Enforcement

Each phase must explicitly verify:

### Authentication & User Isolation
```typescript
// ❌ NEVER: Query without user scoping
const memories = await db.memory.findMany()

// ✅ ALWAYS: Scope to current user
const memories = await db.memory.findMany({
  where: { userId: currentUser.id }
})
```

### Approval Workflow
```
Message → Classification → Candidate (PENDING)
                              ↓
                          User Review
                              ↓
                      [Approve/Reject/Modify]
                              ↓
                      Memory (APPROVED) or Removed
```

No memory exists without this workflow.

### No Autonomous Actions
- Jhadina suggests, user decides
- No automatic memory creation
- No automatic approval
- No automatic sharing
- No automatic external actions

### Data Lifecycle
```
Creation:  ReasoningEvent → MemoryCandidate
Review:    User → Approval action
Approval:  Candidate → Memory
Audit:     Every step logged in TimelineEvent
Deletion:  Only by explicit user action
```

---

## 📊 Sprint 2 Artifacts

| Artifact | Purpose | Owner | Status |
|----------|---------|-------|--------|
| BACKEND_CONTRACT.md | API specification | Backend Lead | 📋 Ready |
| DATABASE_DESIGN.md | Schema & migrations | Database Lead | 📋 Ready |
| COMMAND_CENTER_UX.md | Screen specifications | UX Lead | 📋 Ready |
| SPRINT_2_TASKS.md | Task breakdown | Project Lead | 📋 Ready |

---

## 🎯 Next Actions

**Once This Plan is Approved:**

1. **Do NOT begin implementation yet**
2. **Phase A is next step only:** Backend Contract validation
   - Frontend and backend engineers review `BACKEND_CONTRACT.md`
   - Agree on every endpoint, request shape, response shape
   - Lock the contract
3. **Only after Phase A is locked:** Move to Phase B implementation

**This ensures:**
- Frontend and backend stay synchronized
- No wasted work on mismatched assumptions
- Changes to contract require team discussion
- Architectural boundaries remain clear

---

## ✅ Success Criteria (End of Sprint 2)

**Functional:**
- [ ] User opens Jhadina UI
- [ ] User sends a message
- [ ] System responds
- [ ] Memory candidate appears
- [ ] User approves memory
- [ ] Memory saves to database
- [ ] User closes application
- [ ] User reopens application
- [ ] Memory still there
- [ ] Timeline shows full history
- [ ] Search works
- [ ] System health shows correct status

**Technical:**
- [ ] Zero cross-user data access
- [ ] All errors handled gracefully
- [ ] No orphaned data in database
- [ ] Audit trail complete
- [ ] Authentication enforced on every endpoint
- [ ] All invariants preserved

**Quality:**
- [ ] Real-world test completed
- [ ] Test report generated
- [ ] Metrics collected
- [ ] No guardrail violations

---

## 🚀 What Comes After

**Sprint 3 — Intelligence Layer:**
- Context Builder (remembering user patterns)
- Pattern Engine (finding connections between memories)
- Research/Verification (validating and updating knowledge)

This is where Jhadina becomes actively useful, not just a database.

---

## 📝 Document Status

This plan document serves as the **master roadmap** for Sprint 2. All future work should reference these phases and artifacts.

**Waiting for:** Approval to proceed with Phase A (Backend Contract)

