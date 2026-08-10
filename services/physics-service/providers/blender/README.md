# Blender Physics Provider

First concrete physics provider for Jhadina Studio. Blender is used as the execution runtime for cloth, hair/curve and rigid-body simulation. The service boundary remains provider-neutral.

## Runtime

The provider accepts a normalized simulation request and produces a cached `.blend`/Alembic-compatible simulation artifact plus metrics consumed by Physics QC.

Environment:
- `BLENDER_BIN` — Blender executable path
- `PHYSICS_ARTIFACT_ROOT` — persistent artifact directory

The provider should run GPU acceleration where the installed Blender build/scene feature supports it, while retaining CPU fallback for deterministic CI/smoke tests.
