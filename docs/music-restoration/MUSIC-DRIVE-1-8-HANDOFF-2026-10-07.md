# MUSIC-DRIVE.1-.8 — approved music assets via existing Google Homebase DVC

**Dependency:** draft PR #1139 (GOOGLE-HOMEBASE); this change intentionally sits on that branch.
**Authority:** \`crispy-waddle\` Music Core owns case/source/version/QC. Google Drive is an archive only.

## Source completed in this batch
1. \`music_assets.py\` consumes the **existing** Music Restoration DAW manifest (\`caseId\`, \`currentVersionId\`, \`sourceArtifactId\`, \`tracks[].artifactId/role/fileName/sha256\`).
2. Validates one-to-one track identities, safe filenames, bounded audio sizes and exact source SHA-256.
3. Requires an existing DVC workspace, explicit PUBLIC/CLEARED_NON_SENSITIVE classification, rights attestation and an approval ID; **no default classification**. This approval ID is an operator-supplied record, not a substitute for Jhadina Action Core authorization.
4. Stages immutable local bytes into the existing \`dvc-workspace/assets\`, records private local immutable receipts, never replaces altered artifacts.
5. \`track\` delegates to existing \`dvc_assets.track\` instead of creating another OAuth/Drive client.
6. \`push\` additionally demands \`--live\`, \`MUSIC_DRIVE_LIVE_APPROVED=YES\`, exact DVC folder and matching individual approvals; success means *command succeeded*, not restore proof.
7. \`restore\` refuses locally present audio, pulls exact DVC pointer using existing adapter, then recomputes each SHA-256. It does NOT clear working assets, create hosts, or assert production restoration readiness.
8. Tests cover false authorizations, tampering, source drift, symlinks, remote-only readback and no-upload defaults.

## Host-only commands (after real machine OAuth and cleared media)

\`\`\`bash
cd crispy-waddle
python3 infrastructure/homebase/google-drive/dvc_assets.py bootstrap
python3 infrastructure/homebase/google-drive/music_assets.py stage \
  --manifest /approved-export/manifest.json --source-dir /approved-export/stems \
  --classification CLEARED_NON_SENSITIVE --rights-verified --authorization-id <owner-approved-id>
python3 infrastructure/homebase/google-drive/music_assets.py track --manifest /approved-export/manifest.json
# Review each generated DVC pointer, classification and manifest.
export MUSIC_DRIVE_LIVE_APPROVED=YES
python3 infrastructure/homebase/google-drive/music_assets.py push --manifest /approved-export/manifest.json --live
# On an independently prepared/restored DVC cache+pointer, with local audio absent:
python3 infrastructure/homebase/google-drive/music_assets.py restore --manifest /approved-export/manifest.json --live
\`\`\`

Never paste credentials into this chat. Run commands only on an owner-authorized worker—not iPhone. The ChatGPT Drive connection is not a worker OAuth credential. Unreleased/private or uncleared audio is **not eligible** for this DVC remote. A future encrypted private-audio adapter must be separately commissioned and reviewed, not implemented by simply bypassing classification.

## Gaps intentionally blocked (not marked live-complete)
- No real worker OAuth, live push/pull or remote-only hash readback observed.
- No automatic upload from Restoration Studio; a user/worker must export a manifest and approve staging.
- No production-private music archive or complete encrypted media backup.
- No Google Drive transactional authority, background iPhone worker, or replacement for Supabase/RunPod.
- The DVC result is archive evidence, **not** full RESTORE.FINAL certification.
