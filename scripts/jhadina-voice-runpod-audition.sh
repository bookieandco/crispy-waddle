#!/usr/bin/env bash
set -euo pipefail

: "${JHADINA_QWEN3_TTS_TOKEN:?Set JHADINA_QWEN3_TTS_TOKEN.}"

QWEN_PORT="${JHADINA_QWEN3_TTS_PORT:-8093}"
QWEN_BASE_URL="${JHADINA_QWEN3_TTS_BASE_URL:-http://127.0.0.1:$QWEN_PORT}"
QWEN_BASE_URL="${QWEN_BASE_URL%/}"
COUNT="${JHADINA_VOICE_AUDITION_COUNT:-4}"
OUT_DIR="${JHADINA_VOICE_AUDITION_DIR:-/workspace/jhadina/voice-reference/candidates}"
MODEL_ID="${JHADINA_QWEN3_TTS_MODEL_ID:-Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign}"
VOICE_REF="${JHADINA_QWEN3_TTS_VOICE_REF:-jhadina-qwen-v1}"
TEXT="Alright, I have it. Here is the clean version, and then we can deal with the weird part. This part matters: I am separating what we know from what we are still assuming."
INSTRUCTION="Original adult feminine assistant voice. Warm and grounded, conversational and clear, unhurried without sounding sleepy, confident without sounding theatrical, emotionally present without forced sentimentality, with subtle playful intelligence. Natural pauses, clean diction, medium-low vocal energy, and enough expressive range to move between serious precision, dry humor, affectionate banter, and reflective conversation while remaining recognizably the same speaker. Do not imitate any real person or character."

if ! [[ "$COUNT" =~ ^[0-9]+$ ]] || (( COUNT < 2 || COUNT > 8 )); then
  echo "JHADINA_VOICE_AUDITION_COUNT_INVALID" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
MANIFEST="$OUT_DIR/manifest.json"
printf '{"identity":"voice:jhadina:canonical:v1","profile":"jhadina:canonical","state":"candidate_unapproved","qualityClaim":false,"candidates":[]}\n' >"$MANIFEST"

for index in $(seq 1 "$COUNT"); do
  seed=$((1000 + index * 137))
  response="$OUT_DIR/candidate-$index.response.json"
  wav="$OUT_DIR/candidate-$index.wav"

  jq -n \
    --arg text "$TEXT" \
    --arg language "en-US" \
    --arg profile "jhadina:canonical" \
    --arg identity "voice:jhadina:canonical:v1" \
    --arg model "$MODEL_ID" \
    --arg voice "$VOICE_REF" \
    --arg instruction "$INSTRUCTION" \
    --argjson seed "$seed" \
    '{
      text:$text,
      language:$language,
      voiceProfileId:$profile,
      voiceIdentityId:$identity,
      modelId:$model,
      providerVoiceRef:$voice,
      instruction:$instruction,
      seed:$seed,
      delivery:{
        style:"normal",
        rate:1.0,
        warmth:0.72,
        groundedConfidence:0.82,
        conversationality:0.86,
        playfulness:0.18,
        energy:0.56
      }
    }' >/tmp/jhadina-voice-design-request.json

  http_code="$(curl -sS \
    -o "$response" \
    -w '%{http_code}' \
    -X POST "$QWEN_BASE_URL/v1/design" \
    -H "Authorization: Bearer $JHADINA_QWEN3_TTS_TOKEN" \
    -H "Content-Type: application/json" \
    --data @/tmp/jhadina-voice-design-request.json || true)"
  if [[ "$http_code" != "200" ]]; then
    echo "JHADINA_VOICE_DESIGN_HTTP_ERROR:candidate=$index:http=$http_code" >&2
    cat "$response" >&2 2>/dev/null || true
    exit 1
  fi

  candidate_unapproved="$(jq -r 'if has("candidateUnapproved") then (.candidateUnapproved|tostring) else "missing" end' "$response")"
  quality_claim="$(jq -r 'if has("qualityClaim") then (.qualityClaim|tostring) else "missing" end' "$response")"
  voice_identity="$(jq -r '.voiceIdentityId // empty' "$response")"
  returned_model="$(jq -r '.modelId // empty' "$response")"
  returned_voice_ref="$(jq -r '.providerVoiceRef // empty' "$response")"

  [[ "$candidate_unapproved" == "true" ]] || {
    echo "JHADINA_VOICE_CANDIDATE_AUTHORITY_INVALID:candidate=$index:value=$candidate_unapproved" >&2
    exit 1
  }
  [[ "$quality_claim" == "false" ]] || {
    echo "JHADINA_VOICE_QUALITY_CLAIM_INVALID:candidate=$index:value=$quality_claim" >&2
    exit 1
  }
  [[ "$voice_identity" == "voice:jhadina:canonical:v1" ]] || {
    echo "JHADINA_VOICE_IDENTITY_INVALID:candidate=$index:value=$voice_identity" >&2
    exit 1
  }
  [[ "$returned_model" == "$MODEL_ID" ]] || {
    echo "JHADINA_VOICE_MODEL_INVALID:candidate=$index:value=$returned_model" >&2
    exit 1
  }
  [[ "$returned_voice_ref" == "$VOICE_REF" ]] || {
    echo "JHADINA_VOICE_PROVIDER_REF_INVALID:candidate=$index:value=$returned_voice_ref" >&2
    exit 1
  }

  jq '{provider,providerTaskId,voiceProfileId,voiceIdentityId,modelId,providerVoiceRef,mimeType,sampleRateHz,candidateUnapproved,approvalState,qualityClaim,audioSha256}' "$response"

  jq -r '.audioBase64' "$response" | base64 -d >"$wav"
  sha="$(sha256sum "$wav" | awk '{print $1}')"
  returned_sha="$(jq -r '.audioSha256 // empty' "$response")"
  test "$sha" = "$returned_sha"

  duration="$(python3 - "$wav" <<'PY'
import sys, wave
with wave.open(sys.argv[1], "rb") as handle:
    print(handle.getnframes() / float(handle.getframerate()))
PY
)"
  provider_task="$(jq -r '.providerTaskId // empty' "$response")"
  test -n "$provider_task"

  candidate="$(jq -n \
    --arg id "jhadina-audition:${seed}" \
    --arg file "candidate-$index.wav" \
    --arg sha "$sha" \
    --arg providerTaskId "$provider_task" \
    --arg modelId "$MODEL_ID" \
    --arg providerVoiceRef "$VOICE_REF" \
    --arg transcript "$TEXT" \
    --arg duration "$duration" \
    --arg seed "$seed" \
    '{
      id:$id,
      file:$file,
      artifactSha256:$sha,
      provider:"qwen3-tts",
      providerTaskId:$providerTaskId,
      modelId:$modelId,
      providerVoiceRef:$providerVoiceRef,
      voiceIdentityId:"voice:jhadina:canonical:v1",
      calibrationPackId:"jhadina-voice-calibration:v1",
      calibrationSampleIds:["jhadina-calibration:v1:normal","jhadina-calibration:v1:serious"],
      transcript:$transcript,
      durationSeconds:($duration|tonumber),
      seed:($seed|tonumber),
      state:"candidate_unapproved",
      qualityClaim:false,
      provenanceRefs:[
        "JHADINA-VOICE.5:Qwen3-TTS-VoiceDesign",
        "JHADINA-VOICE.3:jhadina-voice-calibration:v1"
      ]
    }')"

  tmp="$MANIFEST.tmp"
  jq --argjson candidate "$candidate" '.candidates += [$candidate]' "$MANIFEST" >"$tmp"
  mv "$tmp" "$MANIFEST"
done

jq . "$MANIFEST"
echo "JHADINA_VOICE_AUDITION_CANDIDATES_READY:$OUT_DIR"
