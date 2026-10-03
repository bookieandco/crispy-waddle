# Director Speaker QC

Private speaker-identity evidence worker for Director.

It uses a pinned SpeechBrain ECAPA-TDNN VoxCeleb speaker-recognition model to produce provider-independent acoustic fingerprints and cosine-similarity measurements. It does **not** approve voices, create Director voice identities, or choose dialogue delivery.

## Runtime

- Model: `speechbrain/spkrec-ecapa-voxceleb`
- Pinned revision: `ff989f88e92ccc120569763824f8eedd5afc9039`
- Normalization: FFmpeg → mono 16 kHz PCM16 WAV
- Fingerprint: L2-normalized embedding → signed int16 quantization → SHA-256
- Raw speaker embeddings are not persisted by the worker contract.
- The audio-file SHA is separate from the speaker-embedding SHA.
- `qualityClaim` remains false until Director policy/QC consumes the receipt.

## Endpoints

- `GET /health` — loads the pinned model and returns real readiness.
- `POST /v1/fingerprint` — authenticated audio → acoustic fingerprint receipt.
- `POST /v1/verify` — authenticated reference/candidate audio → cosine similarity.

Authentication accepts either the exact production Jhadina Vercel OIDC identity or, for manual/private fallback use, `DIRECTOR_SPEAKER_QC_TOKEN`. Production therefore does not require a copied long-lived speaker bearer secret. Optional runtime overrides exist for model ID/revision/cache/device, but production should retain the pinned admitted model revision.


## Director runtime binding

Production stores the worker location in the service-role-only runtime config:

- `director_speaker_qc_url` — HTTPS worker base URL. Admitted hosts are Railway `*.up.railway.app` or RunPod `*.proxy.runpod.net`.
- `director_speaker_qc_token` — optional legacy/manual bearer fallback; not required for the canonical production OIDC path.

For the canonical path, the Vercel production route asks the machine-authorized SWLC gateway for the URL-only runtime binding and the already-admitted private Bonez candidate. Vercel forwards that candidate directly to `/v1/fingerprint` using its short-lived OIDC token. The speaker worker verifies the exact production Vercel project identity. Vercel then sends only the fingerprint receipt back to SWLC, where the gateway independently validates the pinned model revision, source hash, embedding hash/ref, normalization contract, and `qualityClaim=false` before persistence. Raw embeddings are never persisted and the audio is not returned to the caller.


## Shared Jhadina voice use

Although this service originated under Director, its ECAPA fingerprint and similarity contract is provider-independent and is reused by the canonical Jhadina voice runtime.

Jhadina Voice supplies the exact approved reference bytes and each candidate take to `/v1/verify`; the worker returns measurement evidence only. It still does not approve an identity or choose a TTS provider.

The voice runtime may configure the same private deployment through `JHADINA_SPEAKER_QC_URL/TOKEN`. Keeping one pinned worker avoids a second speaker-identity implementation drifting away from the Bonez QC path.
