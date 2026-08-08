# Jhadina Backend Contract

**Version:** 1.0  
**Last Updated:** August 7, 2026  
**Status:** LOCKED (All future work references this contract)  
**Phase:** Phase 0-1 Alignment Complete

---

## 1. Purpose

This document defines the stable communication contract between all layers that connect to Jhadina's brain:

```
Jhadina UI (Frontend)
        ↓ (HTTP Requests)
    API Layer (/api/v1/*)
        ↓ (Service Methods)
    JanetService
        ↓ (Domain Logic)
    Domain Services (Classifier, etc.)
        ↓ (Data Operations)
    Repositories
        ↓ (Storage)
    PostgreSQL / InMemory
```

**Core Principle:** The frontend consumes capabilities, never implementation details. Services are defined by what they do, not how they do it.

**Guarantee:** This contract remains stable across Sprint 2. Changes to implementation (storage layer, routing, etc.) do not change this contract.

---

## 2. API Endpoint Inventory (Sprint 2)

All endpoints use `/api/v1/` prefix. Single versioning convention.

### Endpoint 1: POST /api/v1/message

**Purpose:** Submit user input to Jhadina for classification, reasoning, and candidate memory generation.

**Request:**
```typescript
{
  "message": string  // 1-5000 characters, required
}
```

**Response (201 Created):**
```typescript
{
  "success": true,
  "data": {
    "reasoningEventId": string,
    "candidateId": string,
    "classification": {
      "type": "PREFERENCE" | "IDENTITY" | "GOAL" | "CONTEXT",
      "confidence": number,
      "reasoning": string
    },
    "systemResponse": string
  }
}
```

**Errors:**
- 400: Invalid input
- 401: Unauthorized
- 500: Internal error

---

### Endpoint 2: POST /api/v1/memory/approve

**Purpose:** Accept a pending memory candidate and promote it to approved memory.

**Request:**
```typescript
{
  "candidateId": string
}
```

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "status": "APPROVED",
    "memoryId": string,
    "savedAt": string,
    "confidence": number
  }
}
```

**Errors:**
- 400: Invalid input
- 404: Not found
- 409: Conflict

---

### Endpoint 3: POST /api/v1/memory/reject

**Purpose:** Decline a pending memory candidate. Candidate is removed from queue.

**Request:**
```typescript
{
  "candidateId": string
}
```

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "status": "REJECTED",
    "removedAt": string
  }
}
```

**Errors:**
- 400: Invalid input
- 404: Not found

---

### Endpoint 4: GET /api/v1/candidates

**Purpose:** Retrieve all pending memory candidates awaiting user approval.

**Query Parameters:**
```
?limit=50&offset=0
```

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "candidates": [
      {
        "id": string,
        "content": string,
        "type": "PREFERENCE" | "IDENTITY" | "GOAL" | "CONTEXT",
        "status": "PENDING",
        "confidence": number,
        "createdAt": string
      }
    ],
    "count": number,
    "limit": number,
    "offset": number
  }
}
```

**Errors:**
- 401: Unauthorized

---

### Endpoint 5: GET /api/v1/memories

**Purpose:** Retrieve all approved memories for the user.

**Query Parameters:**
```
?limit=50&offset=0&type=PREFERENCE
```

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "memories": [
      {
        "id": string,
        "content": string,
        "type": "PREFERENCE" | "IDENTITY" | "GOAL" | "CONTEXT",
        "status": "APPROVED",
        "confidence": number,
        "source": "user_message" | "reasoning",
        "createdAt": string,
        "updatedAt": string,
        "approvedAt": string
      }
    ],
    "count": number,
    "limit": number,
    "offset": number
  }
}
```

**Errors:**
- 401: Unauthorized

---

### Endpoint 6: GET /api/v1/memories/search

**Purpose:** Full-text search across approved memories.

**Query Parameters:**
```
?q=automation&limit=50&offset=0
```

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "results": [
      {
        "id": string,
        "content": string,
        "type": "PREFERENCE" | "IDENTITY" | "GOAL" | "CONTEXT",
        "confidence": number,
        "matchScore": number
      }
    ],
    "count": number,
    "query": string,
    "limit": number,
    "offset": number
  }
}
```

**Errors:**
- 400: Invalid input
- 401: Unauthorized

---

### Endpoint 7: PUT /api/v1/memories/{id}

**Purpose:** Edit an approved memory. Creates new version in history.

**Request:**
```typescript
{
  "content": string,
  "type": "PREFERENCE" | "IDENTITY" | "GOAL" | "CONTEXT"
}
```

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "memoryId": string,
    "newVersion": {
      "id": string,
      "content": string,
      "type": string,
      "createdAt": string
    },
    "previousVersion": {
      "id": string,
      "content": string,
      "createdAt": string
    }
  }
}
```

**Errors:**
- 400: Invalid input
- 404: Not found
- 401: Unauthorized

---

### Endpoint 8: POST /api/v1/memories/{id}/archive

**Purpose:** Archive (soft delete) an approved memory.

**Request:**
```typescript
{}
```

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "memoryId": string,
    "archivedAt": string
  }
}
```

**Errors:**
- 404: Not found
- 401: Unauthorized

---

### Endpoint 9: GET /api/v1/memories/{id}/history

**Purpose:** Retrieve all versions of a memory.

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "memoryId": string,
    "versions": [
      {
        "id": string,
        "content": string,
        "type": string,
        "createdAt": string,
        "isCurrentVersion": boolean
      }
    ],
    "count": number
  }
}
```

**Errors:**
- 404: Not found
- 401: Unauthorized

---

### Endpoint 10: GET /api/v1/timeline

**Purpose:** Retrieve the chronological timeline of all user interactions and system events.

**Query Parameters:**
```
?limit=50&offset=0&type=APPROVAL
```

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "events": [
      {
        "id": string,
        "type": "MESSAGE" | "REASONING" | "APPROVAL" | "REJECTION" | "ARCHIVE",
        "timestamp": string,
        "summary": string,
        "relatedEntityId": string
      }
    ],
    "count": number,
    "limit": number,
    "offset": number
  }
}
```

**Errors:**
- 401: Unauthorized

---

### Endpoint 11: GET /api/v1/timeline/search

**Purpose:** Full-text search across timeline events.

**Query Parameters:**
```
?q=automation&limit=50&offset=0
```

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "results": [
      {
        "id": string,
        "type": string,
        "timestamp": string,
        "summary": string,
        "matchScore": number
      }
    ],
    "count": number,
    "query": string
  }
}
```

**Errors:**
- 400: Invalid input
- 401: Unauthorized

---

### Endpoint 12: GET /api/v1/dashboard

**Purpose:** Load dashboard data for Mission Control screen.

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "pendingCount": number,
    "recentMemories": [
      {
        "id": string,
        "content": string,
        "type": string,
        "createdAt": string
      }
    ],
    "systemStatus": "ok" | "degraded" | "error",
    "timestamp": string
  }
}
```

**Errors:**
- 401: Unauthorized

---

### Endpoint 13: GET /api/v1/user/profile

**Purpose:** Retrieve user profile information.

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "userId": string,
    "email": string,
    "name": string,
    "createdAt": string
  }
}
```

**Errors:**
- 401: Unauthorized

---

### Endpoint 14: PUT /api/v1/user/profile

**Purpose:** Update user profile information.

**Request:**
```typescript
{
  "name": string,
  "email": string
}
```

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "userId": string,
    "name": string,
    "email": string,
    "updatedAt": string
  }
}
```

**Errors:**
- 400: Invalid input
- 401: Unauthorized

---

### Endpoint 15: GET /api/v1/user/preferences

**Purpose:** Retrieve user notification and system preferences.

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "soundEnabled": boolean,
    "notificationVolume": number,
    "approvalAlerts": boolean,
    "systemWarnings": boolean,
    "confirmationSounds": boolean,
    "doNotDisturb": boolean,
    "doNotDisturbStart": string,
    "doNotDisturbEnd": string
  }
}
```

**Errors:**
- 401: Unauthorized

---

### Endpoint 16: PUT /api/v1/user/preferences

**Purpose:** Update user notification and system preferences.

**Request:**
```typescript
{
  "soundEnabled": boolean,
  "notificationVolume": number,
  "approvalAlerts": boolean,
  "systemWarnings": boolean,
  "confirmationSounds": boolean,
  "doNotDisturb": boolean,
  "doNotDisturbStart": string,
  "doNotDisturbEnd": string
}
```

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "updated": boolean,
    "timestamp": string
  }
}
```

**Errors:**
- 400: Invalid input
- 401: Unauthorized

---

### Endpoint 17: GET /api/v1/health

**Purpose:** Check system health and service availability.

**Response (200 OK):**
```typescript
{
  "success": true,
  "status": "ok" | "degraded" | "error",
  "timestamp": string,
  "version": string,
  "services": {
    "api": "ok" | "error",
    "database": "ok" | "error",
    "classifier": "ok" | "error"
  }
}
```

**Errors:**
- 503: Service unavailable

---

## 3. Domain Objects (Sprint 2)

### Memory
```typescript
interface Memory {
  id: string
  userId: string
  content: string
  type: "PREFERENCE" | "IDENTITY" | "GOAL" | "CONTEXT"
  confidence: number
  source: "user_message" | "reasoning"
  status: "APPROVED" | "ARCHIVED"
  createdAt: string
  updatedAt: string
  approvedAt: string
  archivedAt?: string
}
```

### MemoryCandidate
```typescript
interface MemoryCandidate {
  id: string
  userId: string
  content: string
  type: "PREFERENCE" | "IDENTITY" | "GOAL" | "CONTEXT"
  confidence: number
  reasoningEventId: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "MODIFIED"
  createdAt: string
  reviewedAt?: string
}
```

### Approval
```typescript
interface Approval {
  id: string
  userId: string
  candidateId: string
  decision: "APPROVED" | "REJECTED" | "MODIFIED"
  notes?: string
  decidedAt: string
}
```

### ReasoningEvent
```typescript
interface ReasoningEvent {
  id: string
  userId: string
  userMessage: string
  classification: {
    type: "PREFERENCE" | "IDENTITY" | "GOAL" | "CONTEXT"
    confidence: number
    reasoning: string
  }
  candidateId: string
  timestamp: string
}
```

### TimelineEvent
```typescript
interface TimelineEvent {
  id: string
  userId: string
  type: "MESSAGE" | "REASONING" | "APPROVAL" | "REJECTION" | "ARCHIVE"
  summary: string
  relatedEntityId?: string
  timestamp: string
}
```

---

## 4. Error Response Contract (Standardized)

All errors follow this structure:

```typescript
interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
  }
  timestamp: string
}
```

**Error Codes (HTTP Status → Code):**
- 400: INVALID_INPUT
- 401: UNAUTHORIZED
- 403: FORBIDDEN
- 404: NOT_FOUND
- 409: CONFLICT
- 500: INTERNAL_ERROR
- 503: SERVICE_UNAVAILABLE

**Example Error Response:**
```typescript
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "User authentication required"
  },
  "timestamp": "2026-08-07T12:00:00Z"
}
```

---

## 5. Identity & Security Rules

### Rule 1: Every Request Has User Context
User identity is always resolved server-side from authentication token.

### Rule 2: No Cross-User Memory Access
Every query is scoped by user_id. Users cannot see other users' memories.

### Rule 3: Services Never Trust Client-Provided Ownership
Ownership is verified server-side, never accepted from request body.

### Rule 4: User Identity is Resolved Server-Side
Authentication token is the source of truth, never the request body.

### Rule 5: Audit Events are Immutable
Timeline and reasoning events cannot be modified or deleted, only archived.

---

## 6. Frontend Responsibility Boundary

### Frontend MAY Do ✅
- Display memories and candidates
- Submit user messages
- Request approvals/rejections
- Show timeline events
- Render system health
- Display search results
- Handle UI state (loading, error, empty)
- Implement optimistic updates
- Cache responses locally

### Frontend MUST NOT Do ❌
- Create memories directly
- Modify reasoning history
- Bypass approval workflow
- Directly access repositories
- Call service methods directly
- Provide user ID in requests
- Create ReasoningEvents manually
- Modify audit trail
- Access other users' data

---

## 7. Versioning Strategy

### URL Structure
**All Sprint 2 endpoints use `/api/v1/*`**

```
/api/v1/message
/api/v1/memory/approve
/api/v1/memory/reject
/api/v1/candidates
/api/v1/memories
/api/v1/memories/search
/api/v1/memories/{id}
/api/v1/memories/{id}/archive
/api/v1/memories/{id}/history
/api/v1/timeline
/api/v1/timeline/search
/api/v1/dashboard
/api/v1/user/profile
/api/v1/user/preferences
/api/v1/health
```

### Breaking Changes Require New Version
- Removing required field from response
- Changing field type
- Removing endpoint
- Changing error codes

### Non-Breaking Changes
- Adding optional field to response
- Adding new endpoint
- Adding new error code
- Improving documentation

### Migration Path
When v2 introduced:
- Both /api/v1/* and /api/v2/* available
- v1 deprecated but working
- 6 month minimum migration period
- v1 eventually sunset with notice

---

## 8. Sprint 2 Scope (Approved Features)

✅ **Core Workflow:**
- Message submission and classification
- Candidate generation
- User approval/rejection/modification
- Memory persistence
- Timeline tracking

✅ **Data Management:**
- Memory listing and search
- Memory editing (creates version)
- Memory archiving
- Timeline search
- History viewing

✅ **User Control:**
- Profile editing
- Notification preferences
- System health visibility

✅ **Notifications:**
- User-actionable events only
- Configurable sounds
- Quiet hours support

---

## 9. Sprint 3+ Deferred Features

These features are EXPLICITLY NOT in Sprint 2. They will be addressed in future sprints:

❌ **Advanced Memory Types:**
- PROJECT, RELATIONSHIP, DECISION types
- These require intelligence layers beyond current scope

❌ **User Data Operations:**
- Export data as JSON
- Delete all user data
- Advanced privacy controls

❌ **System Telemetry:**
- Resource monitoring (CPU, memory, storage)
- Error logging dashboard
- Advanced analytics

❌ **Advanced Notifications:**
- Push notifications to device
- Email digest/alerts
- SMS alerts
- Notification history/archive

❌ **Autonomous Features:**
- Automatic memory creation
- Autonomous agent actions
- Background pattern detection without user prompt

❌ **External Integrations:**
- Third-party service connections
- API extensions
- Plugin system

---

## 10. Guarantees

This contract guarantees:
- ✅ **Stability:** No endpoint signatures will change during Sprint 2
- ✅ **Consistency:** All errors follow same structure
- ✅ **Security:** Authentication and user scoping enforced
- ✅ **Audit Trail:** Every action recorded
- ✅ **Immutability:** Reasoning and timeline events immutable
- ✅ **Versioning:** Breaking changes get new API version

---

## 11. Conformance Checklist

**Endpoint Conformance:**
- [ ] All 17 endpoints use /api/v1/* prefix
- [ ] All responses match documented schemas
- [ ] All errors match error contract
- [ ] All endpoints require authentication
- [ ] All queries scoped by user_id

**Domain Object Conformance:**
- [ ] Memory uses only Sprint 1 types (4)
- [ ] MemoryCandidate includes reasoningEventId
- [ ] Approval is immutable record
- [ ] ReasoningEvent captures reasoning
- [ ] TimelineEvent captures workflow

**Security Conformance:**
- [ ] User identity extracted from token, not request body
- [ ] No cross-user data access possible
- [ ] Audit trail is immutable
- [ ] All approval workflows enforced

**Scope Conformance:**
- [ ] Sprint 2 features documented
- [ ] Sprint 3+ features explicitly deferred
- [ ] No creep into future scopes

---

## 12. Implementation Notes

**This contract is READ-ONLY during Sprint 2.**

Changes require:
1. Team discussion
2. Documentation update
3. All layer updates (API, Services, Frontend)
4. New version if breaking change

If an issue is discovered:
1. File issue describing problem
2. Discuss with team
3. Document change required
4. Plan for next sprint

The contract is the foundation. Stability matters more than speed.

---

**Status: PHASE 0-1 ALIGNED**

This contract is the source of truth for all Sprint 2 work.

All endpoints use `/api/v1/*`  
All domain types match Sprint 1  
All advanced features deferred to Sprint 3+
