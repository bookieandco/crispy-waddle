# Sports Vision Worker

The first executable NBA physical-vision adapter uses Roboflow model `basketball-ec2xx/1` through the Serverless API. The private API key is read only from `ROBOFLOW_API_KEY`; it is never accepted as a CLI argument, written to receipts, or committed.

Install: `pip install -r requirements.txt`.

Run: `ROBOFLOW_API_KEY=... python src/run_image.py image.jpg --output artifacts/result.json`.

The receipt preserves the input SHA-256, model ID, header-auth transport, prediction payload, and canonical raw-response SHA-256. Downstream NBA-PHYS code must treat detections as model observations, not player identity truth.

Reference designs reviewed for later phases: MohibShaikh/sportvision for detection + ByteTrack/team grouping, roboflow/sports for sports tracking/jersey OCR/court calibration patterns, and IRoNCodeR-J/sport-vision for pose/action streaming. Manual correction features from reference projects are not allowed inside empirical certification trials.
