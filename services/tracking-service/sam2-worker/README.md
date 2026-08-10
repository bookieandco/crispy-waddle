# SAM2 GPU Tracking Worker

Provider runtime boundary for SAM 2 / SAM 2.1 video tracking and segmentation.

## Runtime contract

- `GET /health` — GPU/model readiness
- `POST /v1/track` — accepts a video reference, frame range, target prompts and tracking options
- `GET /v1/jobs/{job_id}` — job status and artifact metadata
- `GET /v1/artifacts/{artifact_id}` — normalized TrackArtifact payload

The worker owns GPU/model execution. The Next.js app never imports SAM2 directly.

## Output

The worker must emit stable object IDs across frames where possible, masks, bounding boxes, optional keypoints, confidence, frame coverage, provider/version metadata, and provenance. Incomplete or failed jobs must not be promoted to downstream rig/physics execution.
