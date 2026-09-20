# JLLM-18Q — Universal Upload UI / Client Integration

Ask Jhadina now exposes one governed attachment surface for images, audio, video, documents, text, and code.

## User flow

```text
type optional intent
  -> Attach a file
  -> choose privacy class
  -> Jhadina chooses transport by size
       <= 6 MiB: authenticated inline multipart upload
       > 6 MiB: signed private TUS session
  -> upload progress
  -> direct upload can pause / resume
  -> secure finalization
  -> perception job polling
  -> completed OR explicit subsystem selection
```

The typed Ask Jhadina prompt is passed as upload intent when the file is selected. The existing `/api/jhadina/command` path is unchanged; attaching media does not directly execute a command.

## Transport selection

The browser chooses transport only by byte size:

- files up to 6 MiB use the small authenticated multipart endpoint;
- larger files use the JLLM-18P signed/resumable private session.

Both paths converge on the same trusted Intelligence Asset and asynchronous perception pipeline.

The client infers MIME only for the existing server allowlist when a browser returns an empty `File.type` (common for Markdown/code files). The server remains authoritative for admission and scan validation.

## TUS behavior

The built-in client uses the returned server contract and does not construct bucket paths or signatures itself.

It sends:

- `Tus-Resumable: 1.0.0`
- signed `x-signature`
- exact `Upload-Length`
- server-returned TUS metadata
- 6 MiB chunks

The unique upload URL is retained in browser local storage for the active signed session. Resume starts with a HEAD request and continues from the server's `Upload-Offset`.

Transient PATCH/network failures reconcile the server offset before retrying. A `409` also triggers offset reconciliation instead of restarting the file.

Pause aborts the active chunk request and preserves the acknowledged byte offset. Resume performs a fresh HEAD before sending more bytes.

## Perception status

After upload/finalization the UI follows `/api/jhadina/perception/[jobId]`.

Visible states:

- preparing
- uploading
- paused
- finalizing / security scan
- processing
- needs selection
- completed
- failed

When the job is `needs_selection`, the UI renders only the routes proposed by the durable perception packet. The user may select one or more of those routes and continue. The backend independently verifies that every selection was actually proposed.

When routing is unambiguous, no route-choice UI is shown.

## Ask Jhadina integration

`UniversalUploadPanel` is mounted directly below the Ask Jhadina command field.

The upload UI does not:

- approve memory;
- invoke ActionExecutor;
- publish media;
- place bets/trades;
- promote OverageOS claims/opportunities;
- mutate Director/Creative assets;
- infer authorization from file content.

It only transfers the file, surfaces perception/routing state, and records explicit route selection when needed.

## Supported picker types

- JPEG / PNG / WebP
- MP4 / QuickTime / OGG video
- MP3 / WAV / OGG audio
- PDF
- plain text / Markdown / CSV
- JSON / JavaScript / TypeScript

The server and Storage bucket retain the authoritative allowlists and size limits.
