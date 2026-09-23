# Jhadina Artifact Scanner

Authenticated malware-scanning boundary for the durable Artifact Core.

## Contract

`POST /v1/scan` accepts multipart form data containing the artifact ID, MIME type, expected byte count, expected SHA-256, and the original upload bytes. The service streams those bytes to ClamAV `clamd` using the `INSTREAM` protocol, recomputes the SHA-256 while streaming, and only returns `clean` when:

1. the bearer token is valid;
2. ClamAV returns `OK`;
3. the scanned byte count matches the Artifact Core record; and
4. the recomputed SHA-256 matches the Artifact Core hash.

ClamAV detections return `rejected`. Scanner outages, protocol errors, size overruns, and hash/size mismatches return non-2xx responses, so the Artifact Core keeps the object in quarantine.

## Required environment

- `JHADINA_MEDIA_SCANNER_TOKEN` — shared secret used only between Jhadina Web and this service.
- `CLAMD_UNIX_SOCKET` — preferred when scanner and ClamAV share a host/socket. Defaults to `/tmp/clamd.sock` when `CLAMD_HOST` is absent.
- `CLAMD_HOST` / `CLAMD_PORT` — optional private-network ClamD endpoint. Never expose ClamD's TCP port publicly.
- `JHADINA_ARTIFACT_SCAN_MAX_BYTES` — defaults to 250 MiB. The deployed ClamD `StreamMaxLength` must be configured to at least the admitted scan size or larger artifacts will safely remain quarantined.

Jhadina Web should point `JHADINA_MEDIA_SCANNER_URL` at this service's `/v1/scan` endpoint and use the same `JHADINA_MEDIA_SCANNER_TOKEN`.

## ClamAV runtime

Use an official supported ClamAV image/version and keep the signature database updated with FreshClam. A private ClamD TCP endpoint is acceptable between isolated services, but ClamAV does not authenticate or encrypt that TCP protocol; use a private network or a Unix socket.

For local testing, an official image such as `clamav/clamav:1.5.4` can provide ClamD. Production admission still requires a live scanner drill with a benign file and the EICAR test signature, plus proof that the ClamD endpoint is not publicly reachable.
