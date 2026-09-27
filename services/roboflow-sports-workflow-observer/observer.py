from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from inference_sdk import InferenceConfiguration, InferenceHTTPClient

API_URL = os.getenv("ROBOFLOW_API_URL", "https://serverless.roboflow.com")


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


def run_workflow(image_path: str) -> dict[str, Any]:
    workspace_name = os.getenv("ROBOFLOW_WORKSPACE_NAME")
    workflow_id = os.getenv("ROBOFLOW_WORKFLOW_ID")
    classes = os.getenv("ROBOFLOW_CLASSES", "")
    if not workspace_name or not workflow_id:
        raise RuntimeError("ROBOFLOW_WORKSPACE_NAME and ROBOFLOW_WORKFLOW_ID are required")

    image = Path(image_path)
    if not image.is_file():
        raise FileNotFoundError("image not found")

    parameters: dict[str, Any] = {}
    if classes.strip():
        parameters["classes"] = classes

    result = client_from_env().run_workflow(
        workspace_name=workspace_name,
        workflow_id=workflow_id,
        images={"image": str(image)},
        parameters=parameters,
        use_cache=True,
    )
    return {
        "provider": "roboflow-serverless",
        "workflowId": workflow_id,
        "authority": "INFERRED_VISUAL_EVIDENCE_ONLY",
        "result": jsonable(result),
    }


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: python observer.py IMAGE_PATH", file=sys.stderr)
        return 2
    try:
        print(json.dumps(run_workflow(sys.argv[1]), ensure_ascii=False))
        return 0
    except Exception as exc:
        # Do not log secrets, environment values, local paths, or raw upstream payloads.
        print(json.dumps({"ok": False, "error": type(exc).__name__}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
