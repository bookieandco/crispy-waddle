# Director Studio SAM2 worker

This service boundary is intentionally model-runtime agnostic at packaging time. `worker.py` defines the validated request/response boundary and a `Sam2Engine` protocol. A concrete SAM2 runtime must implement `track_video`.

Security/authority invariants:
- accepts only a bounded frame range and explicit tracking classes;
- receives asset identifiers, not Jhadina credentials or policy objects;
- rejects output outside the governed frame range;
- forces model-produced tracks to `source=model` and `approved=false`;
- returns mask/keypoint references as evidence, not authority.

The HTTP host that exposes `POST /v1/track` should call `run_sam2`. Model weights, GPU selection and asset resolution remain deployment concerns and are not embedded in Director Core.
