# Jhadina Calendar KMP

This module owns the native calendar presentation adapter for Jhadina Planning.

## Build boundary

The repository does not currently contain a KMP Gradle build/configuration that establishes Kotlin, Compose, or Kizitonwose versions. Therefore this module deliberately does **not** hard-code a Kizitonwose dependency version yet.

Once the KMP build is introduced, the Android presentation source should bind `PlanningCalendarAdapter` to Kizitonwose's `HorizontalCalendar` / week-calendar APIs.

## Architecture

```text
Planning Core (TypeScript)
        |
        v
Planning timeline contract
        |
        v
KMP PlanningTimelineMapper
        |
        v
PlanningCalendarAdapter
        |
        v
Android Kizitonwose UI
```

Calendar selection and navigation are view operations only. They never invoke the Jhadina Action Executor directly.
