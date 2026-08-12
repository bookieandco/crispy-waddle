# Tracking providers

## SAM 2 / SAM 2.1

The first production-target provider is Meta's SAM 2 video predictor. It supports promptable video segmentation and multi-object tracking with a persistent inference state and mask propagation. The provider is external to the Next.js application and should run on a GPU worker.

Set `JHADINA_SAM2_URL` to the deployed worker URL. The adapter intentionally does not claim inference success until the worker returns a completed `TrackArtifact`.

Reference: https://github.com/facebookresearch/sam2
