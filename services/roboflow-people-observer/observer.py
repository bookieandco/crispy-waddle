from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from inference_sdk import InferenceConfiguration, InferenceHTTPClient

API_URL = os.getenv("ROBOFLOW_API_URL", "https://serverless.roboflow.com")
MODEL_ID = os.getenv("ROBOFLOW_PEOPLE_MODEL_ID", "people-detection-o4rdr/12")


def client_from_env() -> InferenceHTTPClient:
    api_key = os.getenv("ROBOFLOW_API_KEY")
    if not api_key:
        raise RuntimeError("ROBOFLOW_API_KEY is required")
    return InferenceHTTPClient(
        api_url=API_URL,
        api_key=api_key,
    ).configure(
        InferenceConfiguration(api_key_transport="header")
    )


def jsonable(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "dict"):
        return value.dict()
    if isinstance(value, (list, tuple)):
        return [jsonable(item) for item in value]
    if isinstance(value, dict):
        return {str(key): jsonable(item) for key, item in value.items()}
    return value


def infer_image(image_path: str) -> dict[str, Any]:
    image = Path(image_path)
    if not image.is_file():
        raise FileNotFoundError(f"image not found: {image}")
    result = client_from_env().infer(str(image), model_id=MODEL_ID)
    return {
        "provider": "roboflow-serverless",
        "modelId": MODEL_ID,
        "authority": "OBSERVATION_ONLY",
        "result": jsonable(result),
    }


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: python observer.py IMAGE_PATH", file=sys.stderr)
        return 2
    try:
        print(json.dumps(infer_image(sys.argv[1]), ensure_ascii=False))
        return 0
    except Exception as exc:
        # Never print API keys, environment values, resolved local paths or raw upstream errors.
        print(json.dumps({"ok": False, "error": type(exc).__name__}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
