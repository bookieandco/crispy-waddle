# PupsonStuff CPU AI Upscaler

Private Railway service for print-resolution recovery.

- Engine: `ls-ads/real-esrgan-serve`
- Source commit: `064efcf90bd5130373e5f756c5b2c77a24081245`
- Model: `realesrgan-x4plus_fp16.onnx`
- Model SHA-256: `e662cfd8c4280d1247b0bf248a09b9a410b5ee231e1c1b24374f03546d53ae6b`
- Runtime: ONNX Runtime CPU
- Service port: 8311
- License: Apache-2.0 for server code; bundled third-party notices preserved.

The service stays Railway-private. Only `pupson-media-gateway-runtime`
may expose its inference path to PupsonStuff, protected by the same bearer
boundary as background removal.

The app's print gate may request scale 2 or 4. Real-ESRGAN performs a genuine
4x learned super-resolution pass; the gateway can downsize a 4x result only
when a 2x final size is requested.
