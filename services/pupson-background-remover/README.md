# PupsonStuff BackgroundRemover Runtime

Railway-compatible runtime for the audited `nadermx/backgroundremover` engine.

- Upstream commit: `fa480627829759b902f8c233388d7aa67ab38099`
- License: MIT (upstream)
- HTTP server dependencies (`flask`, `waitress`) are installed explicitly.
- No Docker `VOLUME` directive is used because Railway rejects Dockerfile volumes.
- PyTorch is installed from the official CPU-only wheel index; the service does not pull CUDA/NVIDIA runtime libraries.
- FFmpeg is intentionally omitted because PupsonStuff uses only the still-image POST path.
- The service is intended to stay Railway-private.
- Only the authenticated `pupson-media-gateway` should receive a public domain.

The U2Net model cache is currently ephemeral. A Railway volume can be added later
without changing the app contract.
