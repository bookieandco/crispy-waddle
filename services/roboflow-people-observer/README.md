# Roboflow People Observer

Optional Director visual-observation worker for:

- provider: Roboflow Serverless
- model: `people-detection-o4rdr/12`
- task: person detection / bounding boxes
- Director authority: `OBSERVATION_ONLY`

Use this model for person-presence and person-region evidence. It does **not** identify people, infer who they are, approve tracks, alter a timeline, or replace the canonical tracking/rig pipeline.

## Secret

Configure the credential only in the deployment secret store:

```bash
ROBOFLOW_API_KEY=...
```

Optional:

```bash
ROBOFLOW_API_URL=https://serverless.roboflow.com
ROBOFLOW_PEOPLE_MODEL_ID=people-detection-o4rdr/12
```

The API key must never be committed, logged, sent in a request body, or exposed to browser/client code. Header authentication is used through `InferenceConfiguration(api_key_transport="header")`.

## Run

```bash
pip install -r requirements.txt
python observer.py /path/to/frame.jpg
```

The worker returns raw provider/model output plus observation-only metadata. Director maps admitted detections into `objectDetectionsToVisualEvidence()`.

## Director role

This detector complements rather than replaces the other perception layers:

- Roboflow people detection: person presence and normalized bounds;
- Human adapter: pose, hands, gaze/orientation and gestures;
- SAM2 tracking worker: temporal tracking and segmentation masks.

No named-person search, face recognition, demographic classification or identity inference is part of this observer path.
