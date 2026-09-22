# Roboflow Cartoon Observer

Optional Director visual-observation worker for the exact model profile:

- provider: Roboflow Serverless
- model: `cartoon-56llr/11`
- Director authority: `OBSERVATION_ONLY`
- intended use: narrow character presence/location evidence only

This worker is **not** a general cartoon-understanding model and never mutates a Director project or timeline.

## Secrets

Set the credential in the deployment secret store:

```bash
ROBOFLOW_API_KEY=...
```

Optional configuration:

```bash
ROBOFLOW_API_URL=https://serverless.roboflow.com
ROBOFLOW_CARTOON_MODEL_ID=cartoon-56llr/11
```

Do not commit, log, paste into source, or send the API key in a request body. The worker uses header-based auth through `InferenceConfiguration(api_key_transport="header")`.

## Run

```bash
pip install -r requirements.txt
python observer.py /path/to/frame.jpg
```

The worker returns provider/model metadata plus raw inference output. Director must map detections through `objectDetectionsToVisualEvidence()`, apply the admitted class list from `ROBOFLOW_CARTOON_56LLR_V11`, persist evidence/provenance, and then pass any visual edit through the normal Director evidence/QC gates.

## Security boundary

The worker receives only the image/frame needed for inference. It receives no Jhadina session, project mutation authority, approval authority, Social publishing authority, or other subsystem credentials.
