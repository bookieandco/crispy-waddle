# Jhadina Jarvis / Embodiment Blueprint

**Status:** Blueprint only — no runtime implementation
**Related architecture gate:** JH-046 Core Spine / Action Core reconciliation
**Purpose:** Define the future embodied, multimodal, ambient experience layer for Jhadina without creating a second authority system.

## 1. Vision

Jhadina is the operating system. Jarvis is the embodied interaction layer through which Jhadina can hear, speak, perceive, present herself, interact with the user's computer, and eventually interact with approved external devices and services.

The blueprint is inspired by the useful product pattern demonstrated by `jaredrhod/fullstack-agent`: a single agent experience can assemble persistent memory, voice, visual presence, and optional computer interaction into one coherent experience. Jhadina should adopt the experience principle without copying its architecture or replacing Jhadina's governance model.

## 2. Constitutional rule

**Embodiment is capability, not authority.**

Voice, vision, browser control, desktop control, notifications, device access, and other embodied functions must enter Jhadina through the existing capability and governance boundaries. None may create a privileged escape path around Core Spine, Action Core, approval, identity, audit, or the hard self-modification prohibition.

The intelligence layer may propose. Core Spine governs the decision to pursue the proposal. Action Core authorizes and executes the concrete action.

## 3. Layer model

```text
                         JHADINA OS
                              |
          +-------------------+-------------------+
          |                   |                   |
       JHADINA MIND       GOVERNANCE          JARVIS BODY
          |                   |                   |
       Memory             Values/Policy        Voice
       Context            Security             Hearing
       Patterns           Approval             Vision
       Personality        Action Core           Presence
       Intelligence       Audit                Computer Control
          |                   |                 Notifications
          |                   |                 Devices
          +-------------------+-------------------+
                              |
                        CAPABILITY REGISTRY
                              |
                        ACTION CORE
                              |
                        REAL-WORLD EFFECT
```

## 4. Core subsystems

### 4.1 Voice / Hearing

Responsibilities:
- speech input
- wake/activation behavior
- speech-to-text
- turn detection
- text-to-speech
- interruption/barge-in handling
- voice session state

Security boundary:
- receiving audio does not authorize an action
- voice identity may be an input to identity/context, but must not be treated as sufficient authorization for high-consequence actions without the required policy/approval checks

### 4.2 Vision / Perception

Responsibilities:
- screen perception
- optional camera perception
- document/image understanding
- environment observations
- temporal perception where explicitly enabled

Security boundary:
- perception produces evidence/context, not commands
- camera/screen access is independently permissioned
- sensitive observations should be minimized, scoped, and auditable

### 4.3 Presence

Responsibilities:
- visualizer/avatar
- state display: idle, listening, thinking, speaking, acting, waiting for approval, blocked, error
- optional personality/presentation layer
- multimodal status feedback

Presence must never imply an action happened when Action Core has not confirmed it.

### 4.4 Computer Control / Hands

Responsibilities:
- browser interaction
- desktop interaction
- keyboard/mouse automation
- file/application interaction
- future device control

Security boundary:
- all consequential computer actions become registered capabilities
- concrete execution passes through Action Core
- screen perception and computer control remain separate permissions
- high-risk actions require explicit approval according to policy
- every consequential action produces an audit trail

### 4.5 Notifications / Ambient Operation

Responsibilities:
- proactive alerts
- scheduled reminders
- event-driven prompts
- background monitoring of explicitly authorized sources

Ambient operation must be event-driven and bounded. It cannot become an unrestricted autonomous loop.

## 5. Canonical interaction flow

```text
Human / external event
        |
        v
Jarvis input layer
(voice / vision / UI / event)
        |
        v
Context Builder
        |
        v
Intelligence / Decision Proposal
        |
        v
Core Spine decision governance
        |
   +----+----------------+
   |                     |
 STOP / ASK / DEFER     PROCEED
                           |
                           v
                    Semantic Action
                           |
                           v
                    Capability Registry
                           |
                           v
                       Action Core
                           |
              +------------+------------+
              |            |            |
             DENY       APPROVAL       ALLOW
                           |            |
                         receipt        |
                           +-----+------+
                                 |
                                 v
                              Execute
                                 |
                                 v
                         Ledger / Events
                                 |
                                 v
                          User feedback
```

## 6. Capability families

Initial blueprint families:

- `voice.input`
- `voice.output`
- `vision.screen.observe`
- `vision.camera.observe`
- `computer.browser`
- `computer.desktop`
- `computer.files`
- `notifications.send`
- `device.read`
- `device.control`
- `ambient.monitor`

These are placeholders for capability design. They are **not authorization grants** merely because they exist in the registry.

## 7. Approval classes

Embodied capabilities should be classified by consequence rather than by interface.

### Low consequence
Examples: read-only screen observation, formatting a draft, speaking a response.

### Medium consequence
Examples: modifying a local file, sending a routine notification, submitting a non-sensitive form.

### High consequence
Examples: financial actions, account/security changes, destructive file operations, externally consequential communications.

### Critical
Examples: actions with irreversible or safety-critical consequences.

The exact classification belongs in the capability/policy system, not in the voice, vision, or UI layer.

## 8. Identity and consent

Jhadina must distinguish:

1. **Who is speaking/acting?**
2. **What does the person intend?**
3. **Is the proposed decision permitted?**
4. **Is this concrete action authorized?**
5. **Was the required approval actually provided?**

A voice command such as "send that" is not itself sufficient proof of authorization for a high-consequence action.

## 9. Memory integration

Jarvis events should feed the existing memory architecture selectively.

Examples of durable candidates:
- explicit user preferences
- approved routines
- stable communication preferences
- confirmed device preferences
- recurring workflows

Do not automatically persist raw audio/video streams or every ambient observation as memory.

Memory writes remain governed by the existing memory proposal/approval architecture.

## 10. Audit model

Keep audit levels distinct:

```text
Experience audit:
INPUT_RECEIVED
OBSERVATION_CREATED

Decision audit:
DECISION_PROCEED
POLICY_DENIED
DECISION_APPROVAL_REQUIRED

Action audit:
ACTION_AUTHORIZED
ACTION_APPROVAL_REQUIRED
ACTION_DENIED
ACTION_STARTED
ACTION_COMPLETED
ACTION_FAILED

System audit:
CAPABILITY_REGISTERED
PERMISSION_CHANGED
CONFIGURATION_CHANGED
```

The UI/presence layer must only display completed action claims from authoritative action results; it must not manufacture success states.

## 11. Failure and degradation

Jarvis must fail closed for consequential operations.

Examples:
- microphone unavailable → typed interaction remains available
- vision unavailable → do not invent visual context
- browser unavailable → explain and defer
- identity uncertain → request stronger confirmation where policy requires it
- Action Core unavailable → no consequential execution
- audit unavailable → behavior follows the existing fail-closed audit policy for the action class

Multimodal degradation must never silently lower authorization requirements.

## 12. Evolution constraints

Jarvis may propose:
- new skills
- new capabilities
- workflow improvements
- personality refinements
- device integrations

Jarvis may not autonomously:
- rewrite governing policy
- disable approval requirements
- grant itself capabilities
- alter identity/security invariants
- bypass Action Core
- modify the self-modification prohibition

Evolution proposals must remain subject to the existing governed evolution architecture.

## 13. Implementation phases

### Phase J-1 — Blueprint
- define interfaces and invariants
- map existing capabilities
- identify existing voice/vision/computer-control candidates
- no runtime embodiment changes

### Phase J-2 — Presence shell
- status model
- visualizer/presence UI
- event-driven state transitions
- no new privileged action path

### Phase J-3 — Voice
- speech input/output
- conversational interruption
- voice capability registration
- approval-aware spoken confirmations

### Phase J-4 — Perception
- screen observation
- optional camera observation
- evidence/context contracts
- privacy boundaries

### Phase J-5 — Computer control
- browser/desktop capabilities
- Action Core integration
- approval classes
- action-level audit

### Phase J-6 — Ambient Jhadina
- authorized event sources
- reminders and proactive notifications
- bounded background operation
- user-configurable quiet/attention policies

### Phase J-7 — Device/world integration
- approved external devices
- IoT/service integrations
- stronger identity and consequence policies

## 14. Non-goals

This blueprint does not authorize autonomous general-purpose computer control, unrestricted surveillance, unrestricted background recording, unrestricted self-modification, or direct LLM access to external side effects.

## 15. Relationship to JH-046

JH-046 remains the prerequisite governance reconciliation. The Jarvis/Embodiment layer must consume the resulting Core Spine → Action Core boundaries rather than introducing another policy or executor.

The intended final relationship is:

```text
JARVIS = embodied interface + perception + interaction capabilities
JHADINA = personal operating system + memory + intelligence + governance
ACTION CORE = concrete authorization + execution boundary
```

## 16. Reference project

`jaredrhod/fullstack-agent` is a reference for the product experience of assembling memory, voice, visual presence, and optional hands into one agent. It is not a dependency or architectural authority for Jhadina.
