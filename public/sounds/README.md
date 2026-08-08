# Jhadina Notification Sounds

## Asset Registry

### crippp.mp3 ✅ REGISTERED
- **Status:** Design asset, awaiting implementation phase
- **Purpose:** Default Jhadina notification tone
- **Usage:** User-attention events (approval required, memory decisions, system warnings)
- **Trigger Events:**
  - APPROVAL_REQUIRED
  - MEMORY_APPROVED (optional)
  - SYSTEM_WARNING
- **Duration:** [To be documented]
- **Format:** MP3, 128-192 kbps
- **User Control:** Can disable globally or per-event in settings
- **Background Processing:** No sound for silent background work
- **Playback Rules:** Only after user interaction with page (browser policy)

## Sound Design Philosophy

All Jhadina notification sounds follow these rules:

✅ **Actionable Events Only** — Sound only for decisions user must make  
✅ **User Controlled** — User can disable, adjust volume, set quiet hours  
✅ **No Hidden Work** — Never sounds for background processing  
✅ **Respects Approval Boundary** — No autonomous alerts  
✅ **Device Respectful** — Honors mute switch, browser permissions  

## Implementation Status

**Sprint 2 Phase:**
- [ ] Asset registered in design ✅
- [ ] NOTIFICATION_DESIGN.md updated ✅
- [ ] Frontend notification handler (pending)
- [ ] Settings UI for sound control (pending)
- [ ] Playback integration (pending)

**Do Not Yet:**
- Wire playback logic
- Create audio elements
- Connect to browser APIs

**When to Activate:**
Once frontend notification implementation phase begins (Track E), wire crippp.mp3 to NotificationHandler and connect to user preferences.

---

## Asset Tracking

| File | Location | Status | Notes |
|------|----------|--------|-------|
| crippp.mp3 | public/sounds/crippp.mp3 | ✅ Tracked | Default Jhadina notification tone |

---

**README.md: Asset Registry Complete**
