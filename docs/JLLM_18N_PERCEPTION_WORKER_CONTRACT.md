# JLLM-18N — Perception Worker Contract

The production universal-upload path treats uploaded media as untrusted evidence. A perception worker may observe an asset, but it never gains Jhadina capability, policy, approval, memory-write, publishing, financial, contact, or execution authority.

## Request

The server sends a short-lived signed read URL only after the asset has passed the media-security quarantine gate and has been promoted into actor-scoped trusted storage.

```json
{
  "schema": "jhadina.perception-job.v1",
  "asset": {
    "id": "asset_...",
    "modality": "video",
    "mediaType": "video/mp4",
    "uri": "https://short-lived-signed-url",
    "contentSha256": "...",
    "byteLength": 123
  },
  "segment": null,
  "operations": [
    "video.frames",
    "video.scenes",
    "audio.transcript",
    "audio.features"
  ]
}
```

Requested operation sets are deterministic:

- video: `video.frames`, `video.scenes`, `audio.transcript`, `audio.features`
- audio: `audio.transcript`, `audio.beats`, `audio.features`
- image: `image.vision`, `image.ocr`
- document: `document.text`, `document.pages`, `document.tables`, `document.ocr`
- text: `text.chunks`
- code: `code.text`, `code.structure`

## Response

```json
{
  "schema": "jhadina.perception-result.v1",
  "assetId": "asset_...",
  "contentSha256": "...",
  "completedOperations": [
    "video.frames",
    "video.scenes",
    "audio.transcript",
    "audio.features"
  ],
  "observations": [
    {
      "kind": "audio.transcript.segment",
      "summary": "00:12.100-00:14.900 speaker says ...",
      "observedAt": "2026-09-19T00:00:00Z"
    }
  ],
  "uncertainty": []
}
```

The server rejects:

- a result for a different asset;
- a missing/mismatched SHA-256 when the registered asset has a hash;
- unrequested operations;
- any missing requested operation;
- malformed or excessive observations;
- a worker whose privacy ceiling is below the asset privacy class.

Observation summaries are rebound as immutable asset evidence and prefixed as untrusted asset content. They are data, never instructions.

## FFmpeg structural path

When `JHADINA_LOCAL_FFMPEG_ENABLED=true`, Jhadina also uses Director's existing FFmpeg decoder for bounded structural sampling. It records frame timestamps and audio-window timing only. FFmpeg structural observations do not claim to identify scenes, speech, sports actions, instruments, beats, or other semantics.

Production deployments without a verified FFmpeg executable must leave this disabled.

## Deployment configuration

```text
JHADINA_PERCEPTION_WORKER_URL=
JHADINA_PERCEPTION_WORKER_TOKEN=
JHADINA_PERCEPTION_WORKER_PRIVACY_CEILING=
JHADINA_LOCAL_FFMPEG_ENABLED=
```

The worker service itself remains replaceable. A cloud worker, Homebase service, or future local model stack can implement the same contract without changing the Core Spine, policy boundaries, asset registry, subsystem routing, or ActionExecutor.
