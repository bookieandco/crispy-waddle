# Jhadina Tracking Service

Provider-neutral video tracking and segmentation runtime.

## Inputs

- video URL or stored asset ID
- frame range
- requested classes: character, clothing, hair, hand, prop, environment
- optional seed annotations

## Outputs

A versioned tracking artifact containing temporal tracks, segmentation mask references, keypoints, confidence, provenance, and approval state.

The service must not silently convert low-confidence model output into trusted annotations.

## Downstream

- character/hand tracks → rigging and animation
- clothing/hair/prop/environment masks → physics and collision setup
- all tracks → QC and continuity checking
