# Jhadina Database Design

**Version:** 1.0  
**Status:** DESIGN PHASE (No implementation yet)  
**Purpose:** Define the persistent data model for Sprint 2

---

## 1. Purpose

This document defines the persistent data model that stores Jhadina's state, observations, and decision history.

**What the database stores:**
- User identity and scoping boundaries
- Approved memories (long-term knowledge)
- Pending memory candidates (awaiting approval)
- User approval decisions
- Jhadina's reasoning events (audit trail)
- Timeline of all interactions
- Complete audit history

**What the database does NOT contain:**
- Classification logic (stays in Classifier service)
- Confidence scoring algorithms (stays in JanetService)
- Approval decisions (stays in user, stored in approvals table)
- Action execution (stays in services)
- LLM model weights or embeddings (not in scope)

**Core Design Principle:**

```
Database (State) ← Repositories (Interface) ← Services (Logic)

Services ask repositories for data.
Repositories ask database for storage.
Database knows nothing about intelligence.
```

---

## 2. Database Principles

### Principle 1: Separation of Concerns

```
Database Layer
   ↓ (raw data)
Repository Layer
   ↓ (scoped by user)
Service Layer
   ↓ (business logic)
JanetService
   ↓ (orchestration)
API Layer
   ↓ (HTTP)
Frontend
```

**The database's job:** Store and retrieve data.

**What the database NEVER does:**
- ❌ Classify anything
- ❌ Calculate confidence scores
- ❌ Make approval decisions
- ❌ Execute actions
- ❌ Call external services
- ❌ Contain logic

**Example: Approval Workflow**

WRONG (logic in database):
```sql
-- ❌ Database decides to approve
UPDATE memory_candidates
SET status = 'APPROVED'
WHERE confidence > 0.8
```

CORRECT (logic in service, database stores result):
```typescript
// Service decides
if (candidate.confidence > 0.8) {
  // Service approves
  await approvalRepo.approve(candidateId, userId)
}

// Database stores the decision
INSERT INTO approvals (user_id, candidate_id, decision, created_at)
VALUES (userId, candidateId, 'APPROVED', now())
```

### Principle 2: User Isolation

**Every user-owned table includes a `user_id` column.**

**All queries MUST scope by user:**

CORRECT:
```sql
SELECT * FROM memories
WHERE user_id = ? AND status = 'APPROVED'
```

WRONG:
```sql
SELECT * FROM memories
WHERE status = 'APPROVED'  -- No user_id scope!
```

**User isolation is enforced at:**
1. Database schema (foreign key to users table)
2. Repository layer (every query includes user_id WHERE clause)
3. Service layer (user_id extracted from auth token)
4. API layer (user_id in HTTP response)

### Principle 3: Audit Trail Immutability

**ReasoningEvents and TimelineEvents are immutable.**

- ✅ Can be archived (soft delete)
- ❌ Cannot be modified
- ❌ Cannot be deleted

CORRECT:
```sql
UPDATE timeline_events SET archived_at = now() WHERE id = ?
```

WRONG:
```sql
UPDATE timeline_events SET summary = 'new value' WHERE id = ?
```

### Principle 4: Repository Interface Stability

**Repository interfaces never change.**

Current (InMemory):
```typescript
class MemoryRepository {
  async listApproved(userId: string): Promise<Memory[]>
  async approve(userId: string, candidateId: string): Promise<Memory>
}
```

Future (Postgres):
```typescript
class MemoryRepository {
  // SAME interface, different implementation
  async listApproved(userId: string): Promise<Memory[]>
  async approve(userId: string, candidateId: string): Promise<Memory>
}
```

The database schema serves the repository interface, not vice versa.

---

## 3. Entity Model

### Table 1: users

**Purpose:**  
Identity boundary. Every data row belongs to a user.

**Schema:**
```sql
CREATE TABLE users (
  id        VARCHAR(256) PRIMARY KEY,
  email     VARCHAR(256) UNIQUE NOT NULL,
  name      VARCHAR(256),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**Fields:**
- `id` — Unique user identifier (primary key)
- `email` — User email (unique, for login)
- `name` — User's display name (optional)
- `created_at` — Account creation timestamp
- `updated_at` — Last profile update

---

### Table 2: memories

**Purpose:**  
Approved, long-term knowledge. Once approved, immutable.

**Schema:**
```sql
CREATE TABLE memories (
  id          VARCHAR(256) PRIMARY KEY,
  user_id     VARCHAR(256) NOT NULL,
  
  content     TEXT NOT NULL,
  type        VARCHAR(32) NOT NULL,
  status      VARCHAR(32) DEFAULT 'APPROVED',
  confidence  FLOAT NOT NULL,
  evidence    TEXT,
  source      VARCHAR(32) DEFAULT 'user_message',
  
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_status (user_id, status),
  INDEX idx_created (user_id, created_at DESC),
  INDEX idx_type (user_id, type),
  FULLTEXT INDEX idx_content (content)
)
```

---

### Table 3: memory_candidates

**Purpose:**  
Pending observations awaiting user approval.

**Schema:**
```sql
CREATE TABLE memory_candidates (
  id          VARCHAR(256) PRIMARY KEY,
  user_id     VARCHAR(256) NOT NULL,
  
  content     TEXT NOT NULL,
  type        VARCHAR(32) NOT NULL,
  status      VARCHAR(32) DEFAULT 'PENDING',
  confidence  FLOAT NOT NULL,
  evidence    TEXT,
  
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_status (user_id, status),
  INDEX idx_created (user_id, created_at DESC)
)
```

---

### Table 4: approvals

**Purpose:**  
Record of user decisions. Immutable.

**Schema:**
```sql
CREATE TABLE approvals (
  id          VARCHAR(256) PRIMARY KEY,
  user_id     VARCHAR(256) NOT NULL,
  candidate_id VARCHAR(256) NOT NULL,
  
  decision    VARCHAR(32) NOT NULL,
  notes       TEXT,
  
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES memory_candidates(id) ON DELETE CASCADE,
  INDEX idx_user_time (user_id, created_at DESC),
  INDEX idx_candidate (candidate_id)
)
```

---

### Table 5: reasoning_events

**Purpose:**  
Complete audit trail of Jhadina's reasoning. Immutable.

**Schema:**
```sql
CREATE TABLE reasoning_events (
  id             VARCHAR(256) PRIMARY KEY,
  user_id        VARCHAR(256) NOT NULL,
  
  user_message   TEXT NOT NULL,
  classification JSONB NOT NULL,
  candidate_id   VARCHAR(256),
  
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES memory_candidates(id) ON DELETE SET NULL,
  INDEX idx_user_time (user_id, created_at DESC)
)
```

**JSONB Structure:**
```json
{
  "type": "PREFERENCE",
  "confidence": 0.95,
  "evidence": ["I like automation", "I prefer automated posting"]
}
```

---

### Table 6: timeline_events

**Purpose:**  
Human-readable chronology. Immutable.

**Schema:**
```sql
CREATE TABLE timeline_events (
  id                  VARCHAR(256) PRIMARY KEY,
  user_id             VARCHAR(256) NOT NULL,
  
  event_type          VARCHAR(32) NOT NULL,
  summary             TEXT NOT NULL,
  details             JSONB,
  
  related_memory_id   VARCHAR(256),
  related_candidate_id VARCHAR(256),
  
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (related_memory_id) REFERENCES memories(id) ON DELETE SET NULL,
  FOREIGN KEY (related_candidate_id) REFERENCES memory_candidates(id) ON DELETE SET NULL,
  INDEX idx_user_time (user_id, created_at DESC),
  INDEX idx_user_type (user_id, event_type)
)
```

---

### Table 7: audit_logs

**Purpose:**  
Complete system audit trail. Immutable.

**Schema:**
```sql
CREATE TABLE audit_logs (
  id        VARCHAR(256) PRIMARY KEY,
  user_id   VARCHAR(256) NOT NULL,
  
  action    VARCHAR(32) NOT NULL,
  entity    VARCHAR(32) NOT NULL,
  entity_id VARCHAR(256) NOT NULL,
  
  changes   JSONB,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_time (user_id, created_at DESC),
  INDEX idx_entity (entity, entity_id)
)
```

---

## 4. Entity Relationships

```
users (1) ──→ (many) memories
  │
  ├──→ (many) memory_candidates
  │     │
  │     └──→ (many) approvals
  │
  ├──→ (many) reasoning_events
  ├──→ (many) timeline_events
  └──→ (many) audit_logs
```

**Scoping Rule:**  
Every query includes `WHERE user_id = ?`

---

## 5. Repository Mapping

Repositories implement the interface and use tables:

**MemoryRepository**
- listApproved(userId) → SELECT FROM memories WHERE user_id = ? AND status = 'APPROVED'
- search(userId, query) → SELECT FROM memories with FULLTEXT search
- approve(userId, candidateId) → INSERT INTO memories + UPDATE candidates

**CandidateRepository**
- listPending(userId) → SELECT FROM memory_candidates WHERE user_id = ? AND status = 'PENDING'
- reject(userId, candidateId) → UPDATE status = 'REJECTED'

**TimelineRepository**
- list(userId) → SELECT FROM timeline_events WHERE user_id = ? ORDER BY created_at DESC
- create(event) → INSERT INTO timeline_events

**ReasoningEventRepository**
- create(event) → INSERT INTO reasoning_events
- list(userId) → SELECT FROM reasoning_events WHERE user_id = ? ORDER BY created_at DESC

**ApprovalRepository**
- create(approval) → INSERT INTO approvals
- list(userId) → SELECT FROM approvals WHERE user_id = ?

---

## 6. Index Strategy

**User Lookups:**
```sql
CREATE INDEX idx_user_id ON memories(user_id)
CREATE INDEX idx_user_id ON memory_candidates(user_id)
CREATE INDEX idx_user_id ON reasoning_events(user_id)
CREATE INDEX idx_user_id ON timeline_events(user_id)
```

**Status Filtering:**
```sql
CREATE INDEX idx_user_status ON memory_candidates(user_id, status)
CREATE INDEX idx_user_status ON memories(user_id, status)
```

**Time-Based Queries:**
```sql
CREATE INDEX idx_user_time ON timeline_events(user_id, created_at DESC)
CREATE INDEX idx_user_time ON reasoning_events(user_id, created_at DESC)
CREATE INDEX idx_user_time ON approvals(user_id, created_at DESC)
```

**Search:**
```sql
CREATE FULLTEXT INDEX idx_memory_content ON memories(content)
```

---

## 7. Migration Strategy

### Phase 1: Schema Creation
- Create all 7 tables
- Create all foreign keys
- Create all indexes
- Validate against repository interfaces

### Phase 2: Implement Repositories
- PostgresMemoryRepository
- PostgresCandidateRepository
- PostgresTimelineRepository
- PostgresReasoningEventRepository
- PostgresApprovalRepository

### Phase 3: Test Parity
- Run Sprint 1 tests against both InMemory and Postgres
- Verify identical behavior
- Fix discrepancies

### Phase 4: Switch Default
- Update dependency injection
- Switch to Postgres repositories
- Monitor for issues

### Data Migration
- Sprint 1 data is ephemeral
- No migration needed from InMemory
- Start fresh with clean database

---

## 8. Explicit Non-Goals

**NOT in Sprint 2:**
- ❌ Vector/embedding database
- ❌ Autonomous actions
- ❌ Financial data
- ❌ External integrations
- ❌ Automated memory writes
- ❌ LLM memory storage

---

## 9. Conformance Checklist

Before implementation:

**Schema:**
- [ ] All 7 tables defined
- [ ] All relationships documented
- [ ] user_id in all user-owned tables
- [ ] Immutable tables marked

**Indexes:**
- [ ] Primary keys indexed
- [ ] Foreign keys indexed
- [ ] Common queries indexed
- [ ] FULLTEXT for search

**Security:**
- [ ] Every query scoped by user_id
- [ ] Audit trail captures all actions
- [ ] Reasoning events immutable
- [ ] Timeline events immutable

**Repositories:**
- [ ] MemoryRepository → memories
- [ ] CandidateRepository → memory_candidates
- [ ] TimelineRepository → timeline_events
- [ ] ReasoningEventRepository → reasoning_events
- [ ] ApprovalRepository → approvals
- [ ] All tests pass

---

## 10. Summary

This design:

✅ Maintains architectural boundaries  
✅ Preserves repository abstraction  
✅ Enforces user isolation  
✅ Keeps audit trail immutable  
✅ Supports approval workflow  
✅ Enables efficient queries  

**Status: DESIGN COMPLETE - READY FOR REVIEW**

No implementation yet. No Prisma models. No migrations.

This is the blueprint. Implementation follows approval.
