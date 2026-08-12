# Dolby Atmos Studio Mastering Provider

Container boundary for the uploaded Dolby Atmos Conversion Tool v2.1.2 package.

## Job lifecycle

`queued -> running -> complete -> qc -> promoted|blocked`

## Storage

Each job gets an immutable directory under `/var/lib/jhadina/mastering/<job-id>/` containing:

- source reference
- preset snapshot
- conversion output
- SHA-256 artifact digest
- QC report
- provider/version metadata

The source artifact is never overwritten.

## Presets

- `stereo-delivery` — 48 kHz / 24-bit stereo delivery profile
- `adm-master` — ADM BWF master profile with metadata validation required

## Production execution

The uploaded `.deb` is licensed/proprietary software. The Dockerfile expects the package to be supplied at build time. The CLI invocation is deliberately isolated in `server.py`; exact flags must be configured against the installed licensed build rather than guessed.

QC must block promotion until the generated artifact and its metadata have been validated.
