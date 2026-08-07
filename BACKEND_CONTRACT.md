# Jhadina Backend Contract

**Version:** 1.0  
**Last Updated:** August 6, 2026  
**Status:** LOCKED (All future work references this contract)

---

## 1. Purpose

This document defines the stable communication contract between all layers that connect to Jhadina's brain:

```
Jhadina UI (Frontend)
        ↓ (HTTP Requests)
    API Layer
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

## 2. API Endpoint Inventory

### Endpoint 1: POST /api/message

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
      "type": "PREFERENCE" | "IDENTITY" | "GOAL" | "CONTEXT" | "PROJECT" | "RELATIONSHIP" | "DECISION",
      "confidence": number,
      "evidence": string[]
    },
    "systemResponse": string,
    "responseTimingMs": number
  }
}
```

**Errors:**
- 400: Invalid input
- 401: Unauthorized
- 500: Internal error

---

### Endpoint 2: POST /api/memory/approve

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

### Endpoint 3: POST /api/memory/reject

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

### Endpoint 4: POST /api/memory/modify

**Purpose:** Edit a pending memory candidate and resubmit as new candidate.

**Request:**
```typescript
{
  "candidateId": string,
  "content": string,
  "type": string
}
```

**Response (201 Created):**
```typescript
{
  "success": true,
  "data": {
    "status": "PENDING",
    "candidateId": string,
    "modifiedContent": string,
    "type": string,
    "createdAt": string
  }
}
```

**Errors:**
- 400: Invalid input
- 404: Not found

---

### Endpoint 5: GET /api/candidates

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
        "type": string,
        "status": "PENDING",
        "confidence": number,
        "evidence": string[],
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

### Endpoint 6: GET /api/memories

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
        "type": string,
        "status": "APPROVED",
        "confidence": number,
        "evidence": string[],
        "source": "user_message" | "reasoning" | "suggestion",
        "createdAt": string,
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

### Endpoint 7: GET /api/memories/search

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
        "type": string,
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

### Endpoint 8: GET /api/timeline

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
        "type": "MESSAGE" | "REASONING" | "APPROVAL" | "REJECTION" | "SEARCH",
        "timestamp": string,
        "summary": string,
        "details": Record<string, any>,
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

### Endpoint 9: GET /api/health

**Purpose:** Check system health and service availability.

**Response (200 OK):**
```typescript
{
  "success": true,
  "status": "ok" | "degraded" | "error",
  "timestamp": string,
  "services": {
    "database": "ok" | "error",
    "classifier": "ok" | "error",
    "storage": "ok" | "error"
  }
}
```

**Errors:**
- 503: Service unavailable

---

## 3. Domain Objects

### Memory
```typescript
interface Memory {
  id: string
  userId: string
  content: string
  type: "PREFERENCE" | "IDENTITY" | "GOAL" | "CONTEXT" | "PROJECT" | "RELATIONSHIP" | "DECISION"
  confidence: number
  evidence: string[]
  source: "user_message" | "reasoning" | "suggestion"
  status: "APPROVED" | "ARCHIVED"
  createdAt: string
  approvedAt: string
  updatedAt: string
  archivedAt?: string
}
```

### MemoryCandidate
```typescript
interface MemoryCandidate {
  id: string
  userId: string
  content: string
  type: "PREFERENCE" | "IDENTITY" | "GOAL" | "CONTEXT" | "PROJECT" | "RELATIONSHIP" | "DECISION"
  confidence: number
  evidence: string[]
  status: "PENDING" | "APPROVED" | "REJECTED" | "MODIFIED"
  createdAt: string
  reviewedAt?: string
  updatedAt: string
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
    type: string
    confidence: number
    evidence: string[]
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
  type: "MESSAGE" | "REASONING" | "APPROVAL" | "REJECTION" | "SEARCH"
  summary: string
  details: Record<string, any>
  relatedMemoryId?: string
  relatedCandidateId?: string
  timestamp: string
}
```

---

## 4. Identity & Security Rules

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

## 5. Error Contract

All errors follow this structure:

```typescript
interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    requestId: string
    details?: any
  }
}
```

**Error Codes:**
- INVALID_INPUT (400)
- UNAUTHENTICATED (401)
- UNAUTHORIZED (403)
- NOT_FOUND (404)
- CONFLICT (409)
- INTERNAL_ERROR (500)
- SERVICE_UNAVAILABLE (503)

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
```
/api/v1/message
/api/v1/memory/approve
/api/v1/candidates
/api/v1/memories
/api/v1/memories/search
/api/v1/timeline
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

## 8. Guarantees

This contract guarantees:
- ✅ **Stability:** No endpoint signatures will change
- ✅ **Consistency:** All errors follow same structure
- ✅ **Security:** Authentication and user scoping enforced
- ✅ **Audit Trail:** Every action recorded
- ✅ **Immutability:** Reasoning and timeline events immutable
- ✅ **Versioning:** Breaking changes get new API version

---

## 9. Conformance Checklist

**Endpoint Conformance:**
- [ ] All endpoints return correct HTTP status codes
- [ ] All responses match documented schemas
- [ ] All errors match error contract
- [ ] All endpoints require authentication
- [ ] All queries scoped by user_id

**Security Conformance:**
- [ ] User identity extracted from token, not request body
- [ ] No cross-user data access possible
- [ ] Audit trail is immutable
- [ ] All approval workflows enforced

**Data Conformance:**
- [ ] All objects match domain definitions
- [ ] All timestamps are ISO 8601
- [ ] All IDs use consistent format
- [ ] Confidence scores are 0.0-1.0

**Frontend Boundaries:**
- [ ] Frontend never creates memories directly
- [ ] Frontend never modifies reasoning
- [ ] Frontend never bypasses approval flow
- [ ] Frontend never accesses repositories

---

## 10. Implementation Notes

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

**Status: LOCKED**

This contract is the source of truth for all Sprint 2 work.
