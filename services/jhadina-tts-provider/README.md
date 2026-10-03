# Jhadina Native TTS Provider

GPU sidecar for one Jhadina TTS lane. Run separate processes/environments for Qwen3-TTS and VoxCPM2.

## Authority

This service **does not approve or certify Jhadina's voice**. It only renders WAV audio for the already-declared canonical IDs:

- profile: \`jhadina:canonical\`
- identity: \`voice:jhadina:canonical:v1\`

\`services/jhadina-voice\` remains the production router and independently verifies every production take with the ECAPA speaker-QC worker.

## Modes

### \`design\`

Audition-only. \`POST /v1/design\` produces \`candidate_unapproved\` audio with \`qualityClaim=false\`.

The recommended candidate workflow uses the official Qwen3-TTS VoiceDesign model to create several short original Jhadina reference candidates. VoxCPM2 can also design a voice, but Qwen is the canonical first audition lane so selection remains simple.

### \`clone\`

Production-capable provider lane. Startup requires an exact reference WAV and SHA-256. Qwen uses its Base model's reusable voice-clone prompt; VoxCPM2 uses the same approved reference through isolated-reference cloning.

This means both production providers are anchored to the **same selected reference**, rather than independently inventing two "Jhadina" voices.

## API

- \`GET /health\`
- \`POST /v1/design\`
- \`POST /v1/speak\`

Both POST routes require \`Authorization: Bearer <JHADINA_TTS_TOKEN>\`.

The production speak response echoes the exact \`voiceProfileId\`, \`voiceIdentityId\`, \`modelId\`, and \`providerVoiceRef\`. The upstream Jhadina voice router already fails closed if those values change.

## Processes

Recommended dedicated GPU pod:

- Qwen audition/design lane — temporary, candidate phase only
- Qwen Base clone lane — production
- VoxCPM2 clone lane — production
- Jhadina voice router — production orchestration / ASR / ECAPA enforcement
- speaker-QC may run on the same pod or a separately admitted private worker

Keep Qwen and VoxCPM in separate virtual environments to avoid model-stack dependency conflicts.
