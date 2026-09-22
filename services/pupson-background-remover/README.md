# PupsonStuff Private Media Worker

Railway-compatible private worker used by the authenticated
`pupson-media-gateway-runtime`.

It hosts two audited CPU inference engines in one Railway service:

- Background removal: `nadermx/backgroundremover@fa480627829759b902f8c233388d7aa67ab38099`
- Super resolution: `ls-ads/real-esrgan-serve@064efcf90bd5130373e5f756c5b2c77a24081245`
- Real-ESRGAN model: `realesrgan-x4plus_fp16.onnx`
- Model SHA-256: `e662cfd8c4280d1247b0bf248a09b9a410b5ee231e1c1b24374f03546d53ae6b`

The service stays Railway-private and exposes one internal port:

- `GET /health` — healthy only when both inference engines are reachable.
- `POST /background` — forwards the BackgroundRemover multipart contract.
- `POST /upscale` — forwards Real-ESRGAN's multipart `image` contract.

The public gateway performs bearer authentication, request-size enforcement and
provider-contract translation. No raw inference service receives a public domain.

PyTorch is installed from the official CPU-only wheel index. Real-ESRGAN uses
ONNX Runtime CPU. The upscaler server code's Apache-2.0 license and bundled
third-party notices are copied into the runtime image.
