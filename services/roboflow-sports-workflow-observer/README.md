# Roboflow Sports Workflow Observer

Optional SPORT-SIM visual evidence worker using a Roboflow Workflow.

## Secrets and configuration

Store all provider settings in deployment secrets / environment variables:

```bash
ROBOFLOW_API_KEY=...
ROBOFLOW_WORKSPACE_NAME=...
ROBOFLOW_WORKFLOW_ID=...
ROBOFLOW_CLASSES=...
```

Optional:

```bash
ROBOFLOW_API_URL=https://serverless.roboflow.com
```

The API key must never be committed, logged, embedded in source, or exposed to browser/client code.

Because a credential was pasted into chat during development, rotate that credential before production use.

## Authority boundary

The worker returns:

```text
authority = INFERRED_VISUAL_EVIDENCE_ONLY
```

Workflow output is not canonical sports reality, not an identity signal, and not a betting authorization.

SPORT-SIM may map an admitted visual result into a bounded derived/context feature only after preserving timestamp and evidence lineage.

## Run

```bash
pip install -r requirements.txt
python observer.py /path/to/frame.jpg
```
