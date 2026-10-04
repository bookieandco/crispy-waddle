from __future__ import annotations

import hmac
import json
import os
import threading
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, File, Header, HTTPException, UploadFile


COCO80 = [
    "person","bicycle","car","motorcycle","airplane","bus","train","truck","boat",
    "traffic light","fire hydrant","stop sign","parking meter","bench","bird","cat",
    "dog","horse","sheep","cow","elephant","bear","zebra","giraffe","backpack",
    "umbrella","handbag","tie","suitcase","frisbee","skis","snowboard","sports ball",
    "kite","baseball bat","baseball glove","skateboard","surfboard","tennis racket",
    "bottle","wine glass","cup","fork","knife","spoon","bowl","banana","apple",
    "sandwich","orange","broccoli","carrot","hot dog","pizza","donut","cake","chair",
    "couch","potted plant","bed","dining table","toilet","tv","laptop","mouse",
    "remote","keyboard","cell phone","microwave","oven","toaster","sink",
    "refrigerator","book","clock","vase","scissors","teddy bear","hair drier",
    "toothbrush",
]

TOKEN = os.getenv("DIRECTOR_EDGE_VISION_TOKEN", "").strip()
MODEL_PATH = Path(os.getenv("DIRECTOR_EDGE_VISION_MODEL_PATH", "").strip()).expanduser()
MODEL_ID = os.getenv("DIRECTOR_EDGE_VISION_MODEL_ID", "").strip()
MODEL_LICENSE = os.getenv("DIRECTOR_EDGE_VISION_MODEL_LICENSE", "").strip()
MODEL_PROVIDER = os.getenv("DIRECTOR_EDGE_VISION_PROVIDER", "generic-yolo-onnx").strip()
LICENSE_APPROVED = (
    os.getenv("DIRECTOR_EDGE_VISION_MODEL_LICENSE_APPROVED", "").strip().lower()
    in {"1", "true", "yes"}
)
PRODUCTION_READY_FLAG = (
    os.getenv("DIRECTOR_EDGE_VISION_PRODUCTION_READY", "").strip().lower()
    in {"1", "true", "yes"}
)
INPUT_SIZE = max(160, min(1536, int(os.getenv("DIRECTOR_EDGE_VISION_INPUT_SIZE", "640"))))
CONFIDENCE = max(0.01, min(0.99, float(os.getenv("DIRECTOR_EDGE_VISION_CONFIDENCE", "0.30"))))
IOU = max(0.01, min(0.99, float(os.getenv("DIRECTOR_EDGE_VISION_IOU", "0.45"))))
OUTPUT_FORMAT = os.getenv("DIRECTOR_EDGE_VISION_OUTPUT_FORMAT", "auto").strip().lower()
MAX_UPLOAD_BYTES = max(
    1_000_000,
    min(50_000_000, int(os.getenv("DIRECTOR_EDGE_VISION_MAX_UPLOAD_BYTES", "10000000"))),
)
BIND = os.getenv("DIRECTOR_EDGE_VISION_BIND", "127.0.0.1").strip() or "127.0.0.1"
PORT = int(os.getenv("DIRECTOR_EDGE_VISION_PORT", "8098"))

if OUTPUT_FORMAT not in {"auto", "yolo-v8", "xyxy6"}:
    raise RuntimeError("DIRECTOR_EDGE_VISION_OUTPUT_FORMAT_INVALID")


def class_names() -> list[str]:
    raw = os.getenv("DIRECTOR_EDGE_VISION_CLASS_NAMES_JSON", "").strip()
    if not raw:
        return COCO80
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("DIRECTOR_EDGE_VISION_CLASS_NAMES_INVALID") from exc
    if not isinstance(value, list) or not value or any(not isinstance(item, str) or not item.strip() for item in value):
        raise RuntimeError("DIRECTOR_EDGE_VISION_CLASS_NAMES_INVALID")
    return [item.strip() for item in value]


NAMES = class_names()


def admission_reasons() -> list[str]:
    reasons: list[str] = []
    if not TOKEN:
        reasons.append("DIRECTOR_EDGE_VISION_TOKEN_REQUIRED")
    if not str(MODEL_PATH):
        reasons.append("DIRECTOR_EDGE_VISION_MODEL_PATH_REQUIRED")
    elif not MODEL_PATH.is_file():
        reasons.append("DIRECTOR_EDGE_VISION_MODEL_FILE_REQUIRED")
    if not MODEL_ID:
        reasons.append("DIRECTOR_EDGE_VISION_MODEL_ID_REQUIRED")
    if not MODEL_LICENSE:
        reasons.append("DIRECTOR_EDGE_VISION_MODEL_LICENSE_REQUIRED")
    if not LICENSE_APPROVED:
        reasons.append("DIRECTOR_EDGE_VISION_MODEL_LICENSE_APPROVAL_REQUIRED")
    if not PRODUCTION_READY_FLAG:
        reasons.append("DIRECTOR_EDGE_VISION_PRODUCTION_READY_FLAG_REQUIRED")
    return reasons


NET: cv2.dnn.Net | None = None
NET_ERROR: str | None = None
NET_LOCK = threading.Lock()

if not admission_reasons():
    try:
        NET = cv2.dnn.readNetFromONNX(str(MODEL_PATH))
        NET.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
        NET.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
    except Exception as exc:
        NET_ERROR = type(exc).__name__


def production_ready() -> bool:
    return not admission_reasons() and NET is not None and NET_ERROR is None


def authorized(value: str | None) -> bool:
    if not TOKEN or not value or not value.startswith("Bearer "):
        return False
    return hmac.compare_digest(value[7:], TOKEN)


def require_auth(value: str | None) -> None:
    if not authorized(value):
        raise HTTPException(status_code=401, detail="unauthorized")


def letterbox(image: np.ndarray) -> tuple[np.ndarray, float, int, int]:
    height, width = image.shape[:2]
    if width <= 0 or height <= 0:
        raise HTTPException(status_code=400, detail="DIRECTOR_EDGE_VISION_IMAGE_INVALID")
    scale = min(INPUT_SIZE / width, INPUT_SIZE / height)
    resized_w = max(1, round(width * scale))
    resized_h = max(1, round(height * scale))
    resized = cv2.resize(image, (resized_w, resized_h), interpolation=cv2.INTER_LINEAR)
    canvas = np.full((INPUT_SIZE, INPUT_SIZE, 3), 114, dtype=np.uint8)
    pad_x = (INPUT_SIZE - resized_w) // 2
    pad_y = (INPUT_SIZE - resized_h) // 2
    canvas[pad_y:pad_y + resized_h, pad_x:pad_x + resized_w] = resized
    return canvas, scale, pad_x, pad_y


def normalize_output(raw: Any) -> np.ndarray:
    value = raw[0] if isinstance(raw, (list, tuple)) and raw else raw
    array = np.asarray(value)
    array = np.squeeze(array)
    if array.ndim == 1:
        array = array.reshape(1, -1)
    if array.ndim != 2:
        raise RuntimeError("DIRECTOR_EDGE_VISION_OUTPUT_RANK_INVALID")
    if array.shape[0] <= 256 and array.shape[1] > array.shape[0]:
        array = array.T
    return array.astype(np.float32, copy=False)


def unletterbox_xyxy(
    x1: float, y1: float, x2: float, y2: float,
    scale: float, pad_x: int, pad_y: int,
    width: int, height: int,
) -> tuple[float, float, float, float] | None:
    x1 = (x1 - pad_x) / scale
    x2 = (x2 - pad_x) / scale
    y1 = (y1 - pad_y) / scale
    y2 = (y2 - pad_y) / scale
    x1 = max(0.0, min(float(width), x1))
    x2 = max(0.0, min(float(width), x2))
    y1 = max(0.0, min(float(height), y1))
    y2 = max(0.0, min(float(height), y2))
    if x2 <= x1 or y2 <= y1:
        return None
    return x1, y1, x2, y2


def decode_yolo(
    rows: np.ndarray,
    scale: float,
    pad_x: int,
    pad_y: int,
    width: int,
    height: int,
) -> list[dict[str, Any]]:
    candidates: list[tuple[list[int], float, int]] = []
    if rows.shape[0] == 0:
        return []

    columns = rows.shape[1]
    expected_classes = len(NAMES)

    xyxy6 = OUTPUT_FORMAT == "xyxy6" or (
        OUTPUT_FORMAT == "auto"
        and columns == 6
        and np.nanmax(rows[:, 4]) <= 1.01
    )

    if xyxy6:
        for row in rows:
            score = float(row[4])
            class_id = int(round(float(row[5])))
            if score < CONFIDENCE or class_id < 0:
                continue
            box = unletterbox_xyxy(
                float(row[0]), float(row[1]), float(row[2]), float(row[3]),
                scale, pad_x, pad_y, width, height,
            )
            if not box:
                continue
            x1, y1, x2, y2 = box
            candidates.append(
                ([round(x1), round(y1), round(x2 - x1), round(y2 - y1)], score, class_id)
            )
    else:
        if columns < 5:
            raise RuntimeError("DIRECTOR_EDGE_VISION_OUTPUT_COLUMNS_INVALID")
        no_objectness = columns == 4 + expected_classes or OUTPUT_FORMAT == "yolo-v8"
        for row in rows:
            class_scores = row[4:] if no_objectness else row[5:]
            if not len(class_scores):
                continue
            class_id = int(np.argmax(class_scores))
            class_score = float(class_scores[class_id])
            objectness = 1.0 if no_objectness else float(row[4])
            score = objectness * class_score
            if score < CONFIDENCE:
                continue
            cx, cy, bw, bh = map(float, row[:4])
            box = unletterbox_xyxy(
                cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2,
                scale, pad_x, pad_y, width, height,
            )
            if not box:
                continue
            x1, y1, x2, y2 = box
            candidates.append(
                ([round(x1), round(y1), round(x2 - x1), round(y2 - y1)], score, class_id)
            )

    if not candidates:
        return []

    boxes = [item[0] for item in candidates]
    scores = [item[1] for item in candidates]
    indices = cv2.dnn.NMSBoxes(boxes, scores, CONFIDENCE, IOU)
    if indices is None or len(indices) == 0:
        return []

    selected: list[dict[str, Any]] = []
    for raw_index in np.asarray(indices).reshape(-1):
        index = int(raw_index)
        box, score, class_id = candidates[index]
        x, y, bw, bh = box
        selected.append({
            "classId": class_id,
            "className": NAMES[class_id] if 0 <= class_id < len(NAMES) else f"class:{class_id}",
            "confidence": round(float(score), 6),
            "x": float(x + bw / 2),
            "y": float(y + bh / 2),
            "width": float(bw),
            "height": float(bh),
        })
    return selected


app = FastAPI(title="Jhadina Director Edge Vision", version="1.0")


@app.get("/health")
def health(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    require_auth(authorization)
    reasons = admission_reasons()
    if NET_ERROR:
        reasons.append("DIRECTOR_EDGE_VISION_MODEL_LOAD_FAILED:" + NET_ERROR)
    return {
        "ok": production_ready(),
        "productionReady": production_ready(),
        "provider": MODEL_PROVIDER,
        "modelId": MODEL_ID or None,
        "modelLicense": MODEL_LICENSE or None,
        "licenseApproved": LICENSE_APPROVED,
        "inputSize": INPUT_SIZE,
        "authority": "OBSERVATION_ONLY",
        "reasons": reasons,
    }


@app.post("/detect")
async def detect(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    require_auth(authorization)
    if not production_ready() or NET is None:
        raise HTTPException(status_code=503, detail="DIRECTOR_EDGE_VISION_NOT_PRODUCTION_READY")
    content_type = (file.content_type or "").lower()
    if content_type not in {"image/jpeg", "image/jpg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="DIRECTOR_EDGE_VISION_IMAGE_TYPE_UNSUPPORTED")
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="DIRECTOR_EDGE_VISION_IMAGE_TOO_LARGE")
    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="DIRECTOR_EDGE_VISION_IMAGE_DECODE_FAILED")

    original_h, original_w = image.shape[:2]
    prepared, scale, pad_x, pad_y = letterbox(image)
    blob = cv2.dnn.blobFromImage(
        prepared,
        scalefactor=1.0 / 255.0,
        size=(INPUT_SIZE, INPUT_SIZE),
        mean=(0, 0, 0),
        swapRB=True,
        crop=False,
    )
    try:
        with NET_LOCK:
            NET.setInput(blob)
            raw = NET.forward()
        rows = normalize_output(raw)
        detections = decode_yolo(rows, scale, pad_x, pad_y, original_w, original_h)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="DIRECTOR_EDGE_VISION_INFERENCE_FAILED:"+type(exc).__name__) from exc

    return {
        "ok": True,
        "provider": MODEL_PROVIDER,
        "modelId": MODEL_ID,
        "modelLicense": MODEL_LICENSE,
        "imageWidth": original_w,
        "imageHeight": original_h,
        "detections": detections,
        "authority": "OBSERVATION_ONLY",
        "canEstablishIdentity": False,
        "canEstablishSportsReality": False,
        "canPublish": False,
        "canWager": False,
    }


if __name__ == "__main__":
    uvicorn.run(app, host=BIND, port=PORT, log_level=os.getenv("DIRECTOR_EDGE_VISION_LOG_LEVEL", "info"))
