# Trip Context Core

Provider-neutral context boundary for TruckeroOS trip, stop, equipment, and downtime recommendations.

## Boundary

`TripContext` is the normalized input from Dispatcher/ELD/manual state. `StopContext` describes the verified hub where the equipment is parked. `LifestyleDestination` describes a possible destination and its independently verified access constraints.

`qualifyDestination()` and `rankResetDestinations()` are deterministic qualification helpers. They do not book transportation, move a truck, spend money, or change ELD state.

## Safety model

- Current equipment must have a verified access path to the stop.
- Full-rig equipment cannot be treated as bobtail merely because a destination is bobtail-friendly.
- Rideshare and walk-out recommendations qualify the destination separately from truck approach clearance.
- Missing or stale logistics verification is surfaced as a warning rather than silently treated as verified.
- ELD status is an input; this package does not initiate external actions from a status change.

This package intentionally leaves provider integrations (ELD, parking, maps, transit, rideshare, merchants) outside the domain core.
