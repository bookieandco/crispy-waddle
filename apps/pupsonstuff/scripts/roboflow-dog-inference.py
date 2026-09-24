#!/usr/bin/env python3
import argparse
import json
import os

from inference_sdk import InferenceConfiguration, InferenceHTTPClient


def main():
    parser = argparse.ArgumentParser(description="Run PupsonStuff Roboflow dog vision.")
    parser.add_argument("image", help="Local image path or public image URL")
    parser.add_argument("--skip-workflow", action="store_true")
    args = parser.parse_args()

    api_key = os.environ.get("ROBOFLOW_API_KEY", "").strip()
    if not api_key:
        raise SystemExit("ROBOFLOW_API_KEY is required.")

    client = InferenceHTTPClient(
        api_url=os.environ.get("ROBOFLOW_API_URL", "https://serverless.roboflow.com"),
        api_key=api_key,
    ).configure(
        InferenceConfiguration(api_key_transport="header")
    )

    model_id = os.environ.get("ROBOFLOW_DOG_MODEL_ID", "dogs-gxbwe/1")
    workspace = os.environ.get("ROBOFLOW_WORKSPACE", "morrisdorian84-gmail-com")
    workflow_id = os.environ.get("ROBOFLOW_DOG_WORKFLOW_ID", "general-segmentation-api")

    result = {
        "model": client.infer(args.image, model_id=model_id),
    }

    if not args.skip_workflow:
        result["workflow"] = client.run_workflow(
            workspace_name=workspace,
            workflow_id=workflow_id,
            images={"image": args.image},
            parameters={"classes": os.environ.get("ROBOFLOW_DOG_CLASSES", "dog")},
            use_cache=True,
        )

    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
