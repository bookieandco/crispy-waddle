# MUSIC-RESTORE.FINAL — Real-song certification

## Status

The FINAL certification harness is implemented by this workstream, but **FINAL is not certified merely because the repository builds**.

A durable FINAL receipt may be created only after one real restoration case passes every fail-closed criterion below. The current live runtime commissioning issue is tracked separately in GitHub issue **#822**.

## Certification criteria

A case must prove all of the following:

1. **Production runtime ready**
   - the authenticated Music restoration worker health endpoint reports `productionReady: true`;
   - configuration or CI success alone is insufficient.

2. **Immutable source**
   - the case has its registered `kind=source` artifact;
   - the source has a valid SHA-256 and remains unchanged.

3. **Real four-stem separation**
   - a completed `separate` job has a runtime receipt;
   - that exact receipt/job produced vocals, drums, bass and other artifacts.

4. **Real perception**
   - the immutable source and each required stem have completed `perceive` jobs;
   - each has a runtime receipt;
   - persisted perception evidence exists.

5. **Consequential restoration**
   - the current approved output was actually produced by a completed `repair`, `reconstruct` or `vocal-restore` job;
   - that job has a runtime receipt.

6. **QC + human review**
   - the current version records `qc_passed=true`;
   - its candidate id is the governed human review that approved the same output artifact;
   - that review points to a matching passed QC receipt.

7. **Artifact byte verification**
   - every artifact entering the downloadable DAW package is re-downloaded from private Storage;
   - its bytes are independently SHA-256 checked against the artifact registry.

8. **DAW package proof**
   - the exact self-contained DAW bundle used by Restoration Studio is built;
   - it contains registered audio, REAPER project, Logic guide, markers and provenance manifest;
   - the final ZIP itself receives a SHA-256.

9. **Durable certification receipt**
   - owner, case, immutable source, current version, current output, bundle hash, verified artifact hashes, runtime health and check evidence are written to `music_restoration_final_certifications`;
   - a database trigger independently verifies case/source/version/output/review lineage;
   - the table is forced-RLS and service-role-only.

## Two-stage execution

The FINAL endpoint deliberately runs in two stages.

### Preflight

`GET /api/music/restoration/final?caseId=<id>`

This checks runtime readiness and durable receipts without downloading all audio. It returns each PASS/BLOCKED criterion.

### Certification

`POST /api/music/restoration/final`

with:

```json
{
  "caseId": "music-case:...",
  "certify": true
}
```

If any preflight criterion other than artifact-hash/bundle proof is blocked, certification stops before expensive Storage work.

Only a preflight-passing case proceeds to re-download/hash the audio, build/hash the DAW bundle and attempt the durable certification insert.

## Current external blocker

RunPod audit-repair issue #822 remains the live blocker. Until the existing GPU pod is recommissioned and Music reports production-ready, the `runtime-ready` FINAL check must remain BLOCKED.

This is intentional. The repository must not turn a green build, mocked worker, or architectural completion into a false production certification.
