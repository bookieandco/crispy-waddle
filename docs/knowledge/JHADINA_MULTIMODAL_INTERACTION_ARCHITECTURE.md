# Jhadina Multimodal Interaction Architecture v1

This document defines how voice, vision, touch, gesture, gaze, and other human-computer inputs become Jhadina actions without bypassing policy or authorization.

## Core invariant

**Perception is not intent. Intent is not authorization. Authorization is not execution.**

```text
Human
  |
  +--> Voice
  +--> Vision
  +--> Touch
  +--> Gesture
  +--> Gaze / attention
  |
  v
Perception adapters
  |
  v
Context Builder
  |
  v
Intent / reference resolution
  |
  v
Goal + Plan
  |
  v
Enforcement Boundary
  |
  +--> reject / clarify
  |
  v
Action Executor
  |
  v
Verification
  |
  v
Feedback + Audit
```

## Universal Jhadina button

The global Jhadina button is a universal entry point into this command pipeline. It must not be coupled to Director or any single World.

The button can accept commands such as:

- "Finish this scene."
- "Make five Shorts from this video."
- "Buy more toilet paper."
- "Buy Mom flowers."
- "How do I make this?"
- "Set a timer when we get to that step."

The active context determines what references such as `this`, `that`, and `it` resolve to. The resulting action still passes through the same policy and authorization boundary.

## Perception adapters

Adapters should expose normalized observations rather than performing domain actions directly.

Potential adapter families:

- speech-to-text / voice activity
- object and scene recognition
- face and identity signals, subject to privacy controls
- body/hand pose and gesture recognition
- gaze / head orientation / attention estimation
- touch and pointer interaction
- screen/application context

Model implementations remain replaceable behind capability interfaces. Research repositories may inform implementations, but production Jhadina code should not become dependent on a particular research model unless explicitly adopted.

## Context packet

A multimodal context packet should be bounded and task-oriented:

```text
activeWorld
activeSurface
activeProject
activeTask
selectedObject
recentUserIntent
relevantObservations
approvedMemories
availableCapabilities
pendingActions
```

Raw camera/audio streams should not automatically become durable memory.

## Example: cooking

```text
User is cooking
  -> recipe is active
  -> camera observes pan / ingredients
  -> user asks "how much longer?"
  -> speech + cooking context + visual context resolve the reference
  -> Jhadina answers from the recipe/timer state
```

If the user says "set a timer," timer creation becomes an action and follows the normal authorization/execution path.

## Example: Director

```text
Active World: Director
Selected object: Scene 14 / Shot 03
User: "Make this scene longer."
        |
        v
Intent: modify current scene
        |
        v
Director plan
        |
        v
Policy / approval as required
        |
        v
Shotlist / assembly / render capabilities
```

## Privacy boundary

Perception must be capability-scoped and privacy-aware. Continuous observation is not equivalent to permission to retain. Raw sensory data should remain transient unless a separate governed memory workflow explicitly permits retention.

## HCI relationship

This architecture implements the HCI UX contract in `docs/knowledge/JHADINA_HCI_UX_CONTRACT.md`, especially its rules on truth, authority, consistency, context, humility, recovery, and auditability.
