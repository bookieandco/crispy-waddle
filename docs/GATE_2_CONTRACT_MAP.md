/**
 * GATE 2: ROUTE CONTRACT MAP & ARCHITECTURAL GAP ANALYSIS
 * 
 * Status: DESIGN COMPLETE (Not yet implemented)
 * Date: August 6, 2026
 * 
 * This document defines the exact contracts that route handlers will expose,
 * what backend services they will call (or need to call), and where the 
 * architectural gap between current state and target state exists.
 */

# Gate 2: Route Contract Map & Architectural Gap Analysis

---

## Current State vs. Target Architecture

### Current State (Today)

```
┌─────────────────────────────────────┐
│   React UI (6 Screens)              │
│   ✅ Built, ✅ Renders              │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   Placeholder Route Handlers         │
│   ✅ /api/chat (echoes input)       │
│   ✅ /api/health (hardcoded status) │
│   ❌ All others missing              │
└──────────────┬──────────────────────┘
               │
               ↓
         (NOTHING BELOW)
        
No MemoryRepository
No JanetService
No DecisionEngine
No ContextBuilder
```

**Result**: Everything is a dead end. No data persists. No approvals work. No memory is stored.

### Target Architecture (M2 Complete)

```
┌─────────────────────────────────────┐
│   React UI (6 Screens)              │
│   - Home (Chat)                     │
│   - Approvals                       │
│   - Memory                          │
│   - Timeline                        │
│   - Health                          │
│   - Settings                        │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   Route Handlers (Next.js)          │
│   ✅ /api/chat                      │
│   ✅ /api/approvals                 │
│   ✅ /api/memory                    │
│   ✅ /api/timeline                  │
│   ✅ /api/reasoning/:id             │
│   ✅ /api/health                    │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   JANET Service                     │
│   - classifyInput()                 │
│   - createCandidate()               │
│   - getContext()                    │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   Memory Core / Repository          │
│   - create()                        │
│   - approve()                       │
│   - reject()                        │
│   - list()                          │
│   - search()                        │
│   - getById()                       │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   Persistent Storage                │
│   - In-memory (M2)                  │
│   - PostgreSQL (Production)         │
└─────────────────────────────────────┘
```

**Result**: Data flows end-to-end. Approvals work. Memory persists. Timeline updates.

---

## The Architectural Gap

| Layer | Current | Target | Gap |
|-------|---------|--------|-----|
| **React UI** | ✅ Exists | ✅ Preserved | None |
| **Route Handlers** | ⚠️ Partial (2 stubs) | ✅ Complete (6 endpoints) | Implement 4 missing routes |
| **JANET Service** | ❌ Does not exist | ✅ Required | **Build entire service** |
| **Memory Repository** | ❌ Does not exist | ✅ Required | **Build entire layer** |
| **DecisionEngine** | ❌ Does not exist | ⚠️ Optional for MVP | Can stub for now |
| **ContextBuilder** | ❌ Does not exist | ⚠️ Optional for MVP | Can stub for now |
| **Persistent Storage** | ❌ Does not exist | ✅ Required | Use in-memory for M2 |

---

## Route Contract Map

Each route is defined by:
- **Endpoint** - HTTP method and path
- **Consumes** - Input types
- **Calls** - Backend services it depends on
- **Returns** - Output types
- **Side Effects** - What changes in the system

---

### Route: POST /api/chat

**Purpose**: Main conversation endpoint. Accepts user message, returns AI response.

**Contract**:

```typescript
// Input (Consumes)
interface ChatRequest {
  message: string                    // User's input text
  userId?: string                    // Optional, defaults to "user_demo"
  conversationId?: string            // Optional, for multi-turn conversations
}

// What it calls (Backend Dependencies)
JanetService.processMessage(request: ChatRequest)
  → returns ReasoningEvent
  
MemoryRepository.createCandidate(
  classification: Classification,
  confidence: number,
  content: string
)
  → returns MemoryCandidate (status: PENDING)

// Output (Returns)
interface ChatResponse {
  response: string                   // AI-generated response
  reasoningEventId: string           // ID of reasoning event (for explainability)
  memoryCandidate?: {                // If system wants to propose a memory
    id: string
    type: MemoryType
    content: string
    confidence: number
  }
  confidence: number                 // 0.0 - 1.0, how sure system is
}

// Side Effects
- ✅ Creates reasoning event (logged, immutable)
- ✅ May create pending memory candidate
- ❌ Does NOT commit memory (requires user approval)
- ✅ Updates conversation history
- ❌ Does NOT modify user profile yet
```

**Error Handling**:
```typescript
interface ErrorResponse {
  error: string
  statusCode: 400 | 500
  reasoningEventId?: string           // For debugging
  timestamp: string
}
```

---

### Route: GET /api/approvals

**Purpose**: Fetch pending memory candidates awaiting user approval.

**Contract**:

```typescript
// Input (Consumes)
interface GetApprovalsRequest {
  userId?: string                    // Defaults to "user_demo"
  limit?: number                     // Default 20, max 100
  offset?: number                    // For pagination
  status?: "PENDING" | "APPROVED" | "REJECTED"  // Filter by status
}

// What it calls (Backend Dependencies)
MemoryRepository.listPending(userId: string, limit: number, offset: number)
  → returns MemoryCandidate[]

// Output (Returns)
interface GetApprovalsResponse {
  approvals: MemoryCandidate[]
  total: number                      // Total pending (for pagination)
  userId: string
  timestamp: string
}

// MemoryCandidate structure
interface MemoryCandidate {
  id: string
  type: MemoryType                   // PREFERENCE | IDENTITY | GOAL | CONTEXT
  content: string
  confidence: number                 // 0.0 - 1.0
  createdAt: string                  // ISO8601
  reasoningEventId: string           // What created this candidate
}

// Side Effects
- ❌ Read-only, no state changes
- ✅ Returns current pending queue
```

---

### Route: POST /api/approvals/:id/approve

**Purpose**: User approves a memory candidate. Commits it to permanent storage.

**Contract**:

```typescript
// Input (Consumes)
interface ApproveMemoryRequest {
  id: string                         // Memory candidate ID
  userId?: string                    // Defaults to "user_demo"
  comment?: string                   // Optional user note
}

// What it calls (Backend Dependencies)
MemoryRepository.approve(id: string, userId: string)
  → returns ApprovedMemory

// Output (Returns)
interface ApproveMemoryResponse {
  id: string
  status: "APPROVED"
  approvedAt: string                 // ISO8601 timestamp
  userId: string
  type: MemoryType
  content: string
  confidence: number
}

// Side Effects
- ✅ Changes memory status from PENDING → APPROVED
- ✅ Records approvalAt timestamp
- ✅ Memory now searchable and accessible to JANET
- ✅ Creates audit event (for timeline)
- ✅ Updates user profile (stats: pendingApprovals count decreases)
- ❌ Does NOT modify other memories
```

**Error Handling**:
```typescript
// If memory not found
{ error: "Memory candidate not found", statusCode: 404 }

// If already approved/rejected
{ error: "Memory already processed", statusCode: 400 }

// If authorization fails
{ error: "User not authorized", statusCode: 403 }
```

---

### Route: POST /api/approvals/:id/reject

**Purpose**: User rejects a memory candidate. Discards it.

**Contract**:

```typescript
// Input (Consumes)
interface RejectMemoryRequest {
  id: string
  userId?: string
  reason?: string                    // Optional feedback
}

// What it calls (Backend Dependencies)
MemoryRepository.reject(id: string, userId: string)
  → returns RejectedMemory

// Output (Returns)
interface RejectMemoryResponse {
  id: string
  status: "REJECTED"
  rejectedAt: string
  userId: string
}

// Side Effects
- ✅ Changes memory status from PENDING → REJECTED
- ✅ Records rejectedAt timestamp
- ✅ Memory becomes invisible (archived)
- ✅ Creates audit event (for timeline)
- ✅ Updates user profile (stats: pendingApprovals count decreases)
- ❌ Cannot be undone (by design)
```

---

### Route: GET /api/memory

**Purpose**: Retrieve stored memories (approved only).

**Contract**:

```typescript
// Input (Consumes)
interface GetMemoriesRequest {
  userId?: string
  query?: string                     // Search term (full-text)
  type?: MemoryType                  // Filter by type
  limit?: number
  offset?: number
}

// What it calls (Backend Dependencies)
MemoryRepository.search(query: string, type?: MemoryType, limit: number, offset: number)
  → returns Memory[]

// Output (Returns)
interface GetMemoriesResponse {
  memories: Memory[]
  total: number
  query?: string
  filters?: {
    type?: MemoryType
  }
  timestamp: string
}

// Memory structure (approved only)
interface Memory {
  id: string
  type: MemoryType
  status: "APPROVED"                 // Only approved memories returned
  content: string
  confidence: number
  createdAt: string
  approvedAt: string
  userId: string
}

// Side Effects
- ❌ Read-only, no state changes
- ✅ Returns only APPROVED memories (not PENDING or REJECTED)
```

---

### Route: GET /api/timeline

**Purpose**: Display chronological activity log.

**Contract**:

```typescript
// Input (Consumes)
interface GetTimelineRequest {
  userId?: string
  limit?: number                     // Default 50
  offset?: number
  eventType?: TimelineEventType      // Filter by type
}

type TimelineEventType = 
  | "REASONING"                      // Chat interaction
  | "APPROVAL"                       // User approved memory
  | "REJECTION"                      // User rejected memory
  | "PROMOTION"                      // Pattern promoted (future)
  | "REVIEW"                         // Decision reviewed (future)

// What it calls (Backend Dependencies)
ReasoningEventRepository.list(userId, limit, offset, type?)
  → returns ReasoningEvent[]

MemoryRepository.listApprovals(userId, limit, offset)
  → returns ApprovalEvent[]

// Output (Returns)
interface GetTimelineResponse {
  events: TimelineEvent[]
  total: number
  oldestTimestamp: string
  newestTimestamp: string
}

interface TimelineEvent {
  id: string
  type: TimelineEventType
  timestamp: string
  actor: string                      // "user_demo" or system
  
  // For REASONING events
  reasoning?: {
    message: string
    response: string
    reasoningEventId: string
  }
  
  // For APPROVAL events
  approval?: {
    memoryId: string
    memoryType: MemoryType
    memoryContent: string
    decision: "APPROVED" | "REJECTED"
  }
  
  // For future events
  pattern?: any
  decision?: any
}

// Side Effects
- ❌ Read-only, no state changes
- ✅ Returns all events in reverse chronological order
```

---

### Route: GET /api/reasoning/:id

**Purpose**: Explainability. Show why system gave a response.

**Contract**:

```typescript
// Input (Consumes)
interface GetReasoningRequest {
  id: string                         // Reasoning event ID from ChatResponse
  userId?: string
}

// What it calls (Backend Dependencies)
ReasoningEventRepository.getById(id: string)
  → returns ReasoningEvent with full context

MemoryRepository.getContext(userId: string)
  → returns relevant memories used in reasoning

// Output (Returns)
interface GetReasoningResponse {
  reasoningEventId: string
  timestamp: string
  userMessage: string
  systemResponse: string
  
  context: {
    memories: Memory[]               // Memories used for context
    patterns: Pattern[]              // Patterns identified (future)
    principles: Principle[]          // Principles considered (future)
  }
  
  confidence: number                 // 0.0 - 1.0
  
  decision: {
    type: string                     // Type of decision made
    alternatives?: string[]          // Other possible responses (future)
    reasoning: string                // Human-readable reasoning (future)
  }
}

// Side Effects
- ❌ Read-only, no state changes
- ✅ Returns decision audit trail
```

---

### Route: GET /api/health

**Purpose**: System diagnostics and status.

**Contract**:

```typescript
// Input (Consumes)
// No input

// What it calls (Backend Dependencies)
MemoryRepository.getStats()
  → returns storage statistics

JanetService.health()
  → returns service status (future)

// Output (Returns)
interface HealthResponse {
  status: "ok" | "degraded" | "error"
  timestamp: string
  
  services: {
    janet: {
      status: "ok" | "error"
      responseTime: number           // ms
    }
    memory: {
      status: "ok" | "error"
      count: number                  // Total approved memories
      pendingCount: number
    }
    storage: {
      status: "ok" | "error"
      type: "in-memory" | "postgresql"
    }
  }
  
  user: {
    userId: string
    totalMemories: number
    pendingApprovals: number
    identityMemories: number
  }
  
  version: string                    // "0.1.0" etc.
}

// Side Effects
- ❌ Read-only, no state changes
- ✅ Returns current system state snapshot
```

---

## Backend Service Interfaces

These interfaces do NOT exist yet. They define what must be built.

### JanetService Interface (To Be Implemented)

```typescript
interface JanetService {
  /**
   * Accept user message, return response + classification
   */
  processMessage(request: {
    message: string
    userId: string
    context?: Memory[]               // Previous memories for context
  }): Promise<{
    response: string
    classification: Classification
    confidence: number
  }>
  
  /**
   * Health check
   */
  health(): Promise<{ status: "ok" | "error" }>
  
  /**
   * Classification only (no response)
   */
  classify(text: string): Promise<{
    type: MemoryType
    confidence: number
  }>
}

interface Classification {
  type: MemoryType                   // PREFERENCE | IDENTITY | GOAL | CONTEXT
  confidence: number                 // 0.0 - 1.0
  reasoning?: string                 // Why this classification
}
```

### MemoryRepository Interface (To Be Implemented)

```typescript
interface MemoryRepository {
  // Write operations
  createCandidate(data: {
    userId: string
    content: string
    type: MemoryType
    confidence: number
    reasoningEventId: string
  }): Promise<MemoryCandidate>
  
  approve(candidateId: string, userId: string): Promise<Memory>
  
  reject(candidateId: string, userId: string): Promise<void>
  
  // Read operations
  listPending(userId: string, limit: number, offset: number): Promise<MemoryCandidate[]>
  
  search(query: string, type?: MemoryType, limit?: number, offset?: number): Promise<Memory[]>
  
  getById(id: string): Promise<Memory | null>
  
  getContext(userId: string): Promise<Memory[]>
  
  // Statistics
  getStats(userId: string): Promise<{
    total: number
    pending: number
    byType: Record<MemoryType, number>
  }>
}
```

### ReasoningEventRepository Interface (To Be Implemented)

```typescript
interface ReasoningEventRepository {
  create(data: {
    userId: string
    userMessage: string
    systemResponse: string
    confidence: number
    context?: Memory[]
  }): Promise<ReasoningEvent>
  
  getById(id: string): Promise<ReasoningEvent | null>
  
  list(userId: string, limit: number, offset: number, type?: string): Promise<ReasoningEvent[]>
}

interface ReasoningEvent {
  id: string
  userId: string
  timestamp: string
  userMessage: string
  systemResponse: string
  confidence: number
  context: Memory[]
}
```

---

## Responsibility Matrix

| Responsibility | Owner | Current | Target |
|---|---|---|---|
| Render UI | React | ✅ Implemented | ✅ Preserved |
| HTTP orchestration | Next.js Route Handlers | ⚠️ Partial (2 routes) | ✅ 6 complete routes |
| Classify input | JanetService | ❌ Missing | ✅ Build new |
| Create candidates | MemoryRepository | ❌ Missing | ✅ Build new |
| Store/retrieve memories | MemoryRepository | ❌ Missing | ✅ Build new |
| Manage approvals | MemoryRepository | ❌ Missing | ✅ Build new |
| Track reasoning events | ReasoningEventRepository | ❌ Missing | ✅ Build new |
| Persist data | In-memory (M2) / DB (Production) | ❌ Missing | ✅ Build new |

---

## Implementation Dependency Graph

```
React UI
    ↓
Route Handlers (/api/chat, /api/approvals, /api/memory, /api/timeline, /api/reasoning/:id)
    ↓
JanetService (classifyInput, processMessage)
    ↓
MemoryRepository (create, approve, reject, search, list)
    ↓
ReasoningEventRepository (record reasoning events)
    ↓
Storage Layer (in-memory or database)
```

**Build order for M2:**
1. Storage layer (in-memory)
2. MemoryRepository + ReasoningEventRepository
3. JanetService stub (hardcoded classifications)
4. Route handlers (wire handlers to repositories)
5. Test end-to-end flow

---

## Critical Constraints

### What Cannot Change

- ✅ React UI structure (6 screens, navigation)
- ✅ Route paths (`/api/chat`, `/api/approvals`, etc.)
- ✅ Input/output contracts (interfaces defined above)
- ✅ Constitutional principles (approval required, immutable audit trail, traceability)

### What Can Be Stubbed for MVP

- ⚠️ JanetService (start with hardcoded classifications)
- ⚠️ DecisionEngine (not needed for M2)
- ⚠️ ContextBuilder (can use simple memory filtering)
- ⚠️ Persistent storage (start in-memory, upgrade later)

### What Cannot Be Stubbed

- ❌ MemoryRepository (core to all workflows)
- ❌ Approval workflow (defined in Constitution)
- ❌ Immutable audit trail (every event must be recorded)
- ❌ User approval gate (memories require explicit approval)

---

## Summary: The Gap

**Current State:**
- UI shell exists
- Route stubs exist
- No backend services

**To reach M2:**
1. **Build** MemoryRepository (in-memory)
2. **Build** ReasoningEventRepository (in-memory)
3. **Stub** JanetService (hardcoded, no ML yet)
4. **Implement** 4 missing route handlers
5. **Wire** handlers to repositories
6. **Test** memory approval loop end-to-end

**Then verify**: 
- User sends message
- System creates candidate
- User approves
- Memory stored
- Timeline updates
- Search retrieves memory

That's the first proof Jhadina works as software.

---

**Status: GATE 2 COMPLETE - Contract map and gaps fully defined.**

**Next step: GATE 3 (Execute Milestone 1)** - Verify the frontend actually runs.

Once M1 is verified, implementation begins using these exact contracts.
