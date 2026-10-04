# Director Edge Vision Worker

Low-cost CPU object-detection sidecar for Director Watch/Homebase.

It intentionally does **not** vendor Ultralytics code or model weights. Supply a YOLO-compatible ONNX model at deployment time and explicitly declare/approve its license.

Required environment:

```bash
DIRECTOR_EDGE_VISION_TOKEN=<random server-only token>
DIRECTOR_EDGE_VISION_MODEL_PATH=/models/detector.onnx
DIRECTOR_EDGE_VISION_MODEL_ID=<model-id>
DIRECTOR_EDGE_VISION_MODEL_LICENSE=<license-or-commercial-license-id>
DIRECTOR_EDGE_VISION_MODEL_LICENSE_APPROVED=true
DIRECTOR_EDGE_VISION_PRODUCTION_READY=true
```

Optional:

```bash
DIRECTOR_EDGE_VISION_PROVIDER=generic-yolo-onnx
DIRECTOR_EDGE_VISION_INPUT_SIZE=640
DIRECTOR_EDGE_VISION_CONFIDENCE=0.30
DIRECTOR_EDGE_VISION_IOU=0.45
DIRECTOR_EDGE_VISION_OUTPUT_FORMAT=auto
DIRECTOR_EDGE_VISION_CLASS_NAMES_JSON='["person", "..."]'
DIRECTOR_EDGE_VISION_BIND=0.0.0.0
DIRECTOR_EDGE_VISION_PORT=8098
```

Endpoints:

- `GET /health`
- `POST /detect` multipart field `file`

The response is observation-only object detection. It never identifies people, establishes sports truth, publishes, or wagers.

For a Homebase Watch container on the same host:

```bash
DIRECTOR_WATCH_EDGE_DETECTOR_URL=http://127.0.0.1:8098/detect
DIRECTOR_WATCH_EDGE_DETECTOR_ALLOW_LOCAL_HTTP=true
DIRECTOR_WATCH_EDGE_DETECTOR_TOKEN=<same token>
DIRECTOR_WATCH_EDGE_DETECTOR_PROVIDER=<provider>
DIRECTOR_WATCH_EDGE_DETECTOR_MODEL=<model-id>
DIRECTOR_WATCH_EDGE_DETECTOR_LICENSE=<license>
DIRECTOR_WATCH_EDGE_DETECTOR_LICENSE_APPROVED=true
```

If you deploy an Ultralytics-exported model, review Ultralytics' current AGPL/commercial licensing and use it only under terms appropriate for your deployment.
