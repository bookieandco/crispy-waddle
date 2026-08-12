# Independent Lip-Sync QC

This service is intentionally separate from the Wav2Lip inference runtime. It must measure the rendered result rather than trusting provider-reported success.

## Contract

Input: rendered video/audio asset IDs or resolved media URLs.

Output:

- `sync_offset_ms`: measured average audio/visual alignment offset
- `confidence`: independent mouth/audio alignment confidence, 0..1
- `duration_ms`: measured media duration
- `frames_checked`: frames included in analysis
- `dropped_frames`: detected dropped/invalid frames
- `overall`: QC score 0..100, or null when measurement is unavailable
- `warnings`: human-readable issues

The analyzer currently contains the deterministic scoring layer. A production implementation should plug in a real audio/visual alignment detector and populate `SyncMetrics` from measurements.
