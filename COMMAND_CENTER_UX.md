# Jhadina Command Center UX

**Version:** 1.0  
**Status:** DESIGN PHASE (No UI code yet)  
**Purpose:** Define user experience contract before implementation

---

## 1. Purpose

The Command Center is how humans understand and control Jhadina.

**Its job:**
- Show what Jhadina knows
- Request user decisions on uncertain observations
- Provide complete transparency into actions
- Enable user to correct or override Jhadina's understanding

**Four Core Promises:**

✅ **Awareness** — User always knows what Jhadina has learned  
✅ **Decisions** — User always approves before memories are saved  
✅ **Control** — User can edit, archive, or delete any memory  
✅ **Trust** — Every action is explainable and auditable  

---

## 2. UX Principles

### Principle 1: No Hidden Intelligence

Every meaningful action must be explainable.

User should understand:
- What happened
- Why it happened  
- What information was used

### Principle 2: Human Approval Boundary

**Jhadina MAY:**
- ✅ Observe patterns
- ✅ Organize observations
- ✅ Suggest memories
- ✅ Ask for clarification

**Jhadina MAY NOT:**
- ❌ Silently save memories
- ❌ Make decisions for user
- ❌ Delete memories without confirmation
- ❌ Take external actions
- ❌ Hide reasoning from user

### Principle 3: Avoid Infinite Scroll

Information should be prioritized, not endless.

### Principle 4: Trust Over Features

More functionality later is better than confusing functionality now.

---

## 3. Screen Definitions

### Screen 1: Mission Control (Dashboard)

**Purpose:** User's starting point. Answers: "What does Jhadina need me to know?"

**Components:**
- Pending Approval Counter (clickable)
- Recent Memories List (last 5)
- Activity Summary
- System Status Indicator
- Quick Actions

**States:**
- First-time user
- Active user (with pending approvals)
- No pending actions
- Error state

**API Calls:**
```
GET /api/v1/dashboard
```

---

### Screen 2: Memory Center

**Purpose:** Human-readable view of what Jhadina remembers.

**Components:**
- Filter Bar (by type, search, sort)
- Memory Cards (grouped by type)
- Pagination
- Expandable Details

**Features:**
- Filter by type
- Search across memories
- Sort by: Created, Confidence
- Pagination (20 per page)

**Actions:**
- Edit (creates new version)
- Archive (soft delete)
- View History

**States:**
- Has memories
- Empty state
- Loading
- Search results

**API Calls:**
```
GET /api/v1/memories
PUT /api/v1/memories/{id}
POST /api/v1/memories/{id}/archive
GET /api/v1/memories/{id}/history
```

---

### Screen 3: Approval Center

**Purpose:** Trust checkpoint. Where user reviews and decides on observations.

**Components:**
- Approval Counter (X of Y)
- Candidate Cards (with evidence, confidence)
- Decision Buttons (Approve, Reject, Modify)
- Navigation (Previous, Skip, Next)

**Actions:**
- Approve → Saves memory
- Reject → Removes candidate
- Modify → Edit and resubmit

**States:**
- Candidates waiting
- No pending (all caught up)
- Loading
- Error

**API Calls:**
```
GET /api/v1/candidates?status=PENDING
POST /api/v1/memory/approve
POST /api/v1/memory/reject
POST /api/v1/memory/modify
```

---

### Screen 4: Timeline

**Purpose:** Transparent, chronological history of everything.

**Event Types:**
- MESSAGE (user said something)
- REASONING (Jhadina classified)
- APPROVAL (user approved)
- REJECTION (user rejected)
- SYSTEM (system event)

**Features:**
- Filter by event type
- Search timeline
- Sort: Newest/Oldest
- Date grouping
- Pagination

**States:**
- Has events
- Empty (no timeline yet)
- Search results

**API Calls:**
```
GET /api/v1/timeline
GET /api/v1/timeline/search
```

---

### Screen 5: System Health

**Purpose:** Technical transparency. Is everything working?

**Components:**
- Overall status indicator
- Service health cards (API, Storage, Classifier)
- System resource usage (CPU, Memory, Storage)
- Recent errors log
- Version information
- Refresh button

**Health Indicators:**
- ✅ OK (green)
- ⚠️ Degraded (yellow)
- ❌ Error (red)

**Not a developer console** — designed for trust, not debugging.

**API Calls:**
```
GET /api/v1/health
```

---

### Screen 6: Settings

**Purpose:** User ownership and control over data and preferences.

**Sections:**

1. Account Information
   - Name
   - Email
   - Member since
   - Edit profile

2. Memory Management
   - Total memories
   - Pending approvals
   - Clear archived (with confirmation)

3. Privacy & Data
   - Usage stats opt-in
   - Export data (JSON)
   - Delete all data

4. Notifications
   - Email on new approvals
   - Email weekly summary

5. About
   - Version
   - Privacy Policy
   - Terms of Service

**Dangerous Actions:**
- Delete all data requires confirmation
- "Type DELETE to confirm"
- 5-second delay before button active

**API Calls:**
```
GET /api/v1/user/profile
PUT /api/v1/user/profile
PUT /api/v1/user/preferences
POST /api/v1/user/export
POST /api/v1/user/delete
```

---

## 4. Component Architecture

Reusable UI components (not implemented, just defined):

### MemoryCard
```typescript
Props:
  - memory: Memory
  - onEdit: () => void
  - onArchive: () => void
  - onView: () => void
```

### ApprovalCard
```typescript
Props:
  - candidate: MemoryCandidate
  - onApprove: () => void
  - onReject: () => void
  - onModify: () => void
  - index: number
  - total: number
```

### TimelineEvent
```typescript
Props:
  - event: TimelineEvent
  - onClick: () => void
```

### StatusIndicator
```typescript
Props:
  - status: "ok" | "degraded" | "error"
  - size: "small" | "medium" | "large"
```

### ConfidenceBadge
```typescript
Props:
  - confidence: number (0.0-1.0)
  - size: "small" | "medium"
```

### LoadingState
```typescript
Props:
  - type: "card" | "list" | "full"
```

### EmptyState
```typescript
Props:
  - title: string
  - description: string
  - action?: { label, onClick }
```

---

## 5. Screen-to-API Mapping

| Screen | Endpoint | Purpose |
|--------|----------|---------|
| Mission Control | GET /api/v1/dashboard | Load dashboard data |
| Memory Center | GET /api/v1/memories | List approved memories |
| Memory Center | PUT /api/v1/memories/{id} | Edit memory |
| Memory Center | POST /api/v1/memories/{id}/archive | Archive memory |
| Memory Center | GET /api/v1/memories/{id}/history | View history |
| Approval Center | GET /api/v1/candidates | Get pending |
| Approval Center | POST /api/v1/memory/approve | Approve |
| Approval Center | POST /api/v1/memory/reject | Reject |
| Approval Center | POST /api/v1/memory/modify | Modify |
| Timeline | GET /api/v1/timeline | Get events |
| Timeline | GET /api/v1/timeline/search | Search |
| System Health | GET /api/v1/health | Get status |
| Settings | GET /api/v1/user/profile | Get user |
| Settings | PUT /api/v1/user/profile | Update user |
| Settings | POST /api/v1/user/export | Export data |
| Settings | POST /api/v1/user/delete | Delete account |

---

## 6. UI States

Every screen must handle:

### Loading State
- Skeleton loaders or spinners
- Disabled interactions
- "Loading..." message

### Empty State
- Clear explanation
- Call-to-action
- Link to related screen

### Success State
- Display content
- Show confirmations
- Enable interactions

### Error State
- Clear error message
- Retry button
- Link to System Health

### Permission Denied State
- "No permission to access"
- Next steps suggestion

---

## 7. Explicit Non-Goals

**NOT in Sprint 2 Command Center:**

- ❌ Autonomous agents
- ❌ Financial dashboards
- ❌ External API integrations
- ❌ Marketplace
- ❌ Social features
- ❌ Advanced analytics
- ❌ Predictions
- ❌ Dark mode
- ❌ Mobile app
- ❌ Keyboard shortcuts

---

## 8. Accessibility Requirements

Every screen must:
- ✅ Support keyboard navigation
- ✅ Include alt text
- ✅ Use semantic HTML
- ✅ Sufficient color contrast
- ✅ Support screen readers
- ✅ ARIA labels

---

## 9. Performance Requirements

- Dashboard: < 2s
- Memory Center: < 1.5s
- Approval Center: < 1s
- Timeline: < 2s
- System Health: < 500ms

---

## 10. Conformance Checklist

Before frontend implementation:

**Screen Design:**
- [ ] All 6 screens defined
- [ ] All states (loading, empty, error, success) specified
- [ ] User flows documented
- [ ] User actions mapped to API calls

**Components:**
- [ ] All reusable components listed
- [ ] Component props defined
- [ ] Component states documented

**API Integration:**
- [ ] Screen-to-endpoint mapping complete
- [ ] All request/response shapes match Backend Contract
- [ ] Error handling for each endpoint
- [ ] Loading states for each endpoint

**UX Principles:**
- [ ] No hidden intelligence
- [ ] Human approval boundary enforced
- [ ] No infinite scroll
- [ ] Trust-first design

**Accessibility:**
- [ ] Keyboard navigation possible
- [ ] ARIA labels included
- [ ] Color contrast checked
- [ ] Screen reader compatible

---

## 11. Summary

The Command Center UX:

✅ Provides complete transparency  
✅ Enforces user approval before persistence  
✅ Shows system status for trust  
✅ Enables data control  
✅ Avoids hidden intelligence  
✅ Prioritizes clarity over features  

**Status: DESIGN COMPLETE - READY FOR REVIEW**

No frontend code implemented yet.
No React components created.
No CSS written.

This is the contract. Implementation follows approval.
