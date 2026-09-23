# Jhadina Artifact Extractor

Post-scan extraction runtime for clean durable artifacts.

The extractor never decides whether an upload is safe. Artifact Core + the malware scanner make that decision first. Only a `clean` artifact is eligible for extraction.

Supported source forms:
- PDF → text via pypdf
- DOCX → paragraphs/tables via python-docx
- XLSX → bounded worksheet text via openpyxl
- CSV/JSON/plain text → normalized text
- WAV/MP3/M4A/WebM/MP4 → FFmpeg audio normalization + Faster-Whisper transcript

Every request includes the original source bytes, asset ID, MIME type, byte count and Artifact Core SHA-256. The extractor recomputes the SHA-256 and refuses mismatched input.

Extracted text is written by Jhadina Web to the private `jhadina-artifact-derived` Supabase Storage bucket. The LLM never receives a Storage URI as content; the clean-only Context Resolver downloads the private derivative and injects its bounded text.

Required runtime variables:
- `JHADINA_ARTIFACT_EXTRACTOR_TOKEN`
- `JHADINA_WHISPER_MODEL` (default `small`)
- optional Whisper device/compute settings

Jhadina Web uses:
- `JHADINA_ARTIFACT_EXTRACTOR_URL`
- `JHADINA_ARTIFACT_EXTRACTOR_TOKEN`

Production certification still requires a deployed extractor and real PDF/DOCX/XLSX/audio/video drills.
