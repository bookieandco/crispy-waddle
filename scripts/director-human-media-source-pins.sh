#!/usr/bin/env bash
# Immutable upstream pins for the Director MuseTalk human-media sidecar.
# Updating any revision requires a repository change and recommissioning.

readonly DIRECTOR_MUSETALK_CODE_SOURCE='https://github.com/TMElyralab/MuseTalk.git'
readonly DIRECTOR_MUSETALK_CODE_REVISION='0a89dec45a0192b824e3cf4daf96c239440c5ed8'

readonly DIRECTOR_MUSETALK_MODEL_SOURCE='TMElyralab/MuseTalk'
readonly DIRECTOR_MUSETALK_MODEL_REVISION='2bcb936e2fddb4d86db4c62fd45b387d0c061571'

readonly DIRECTOR_MUSETALK_VAE_SOURCE='stabilityai/sd-vae-ft-mse'
readonly DIRECTOR_MUSETALK_VAE_REVISION='31f26fdeee1355a5c34592e401dd41e45d25a493'

readonly DIRECTOR_MUSETALK_WHISPER_SOURCE='openai/whisper-tiny'
readonly DIRECTOR_MUSETALK_WHISPER_REVISION='169d4a4341b33bc18d8881c4b69c2e104e1cc0af'

readonly DIRECTOR_MUSETALK_DWPOSE_SOURCE='yzd-v/DWPose'
readonly DIRECTOR_MUSETALK_DWPOSE_REVISION='f7c16a3d45ad3783db41471848c80fbc281cabac'

readonly DIRECTOR_MUSETALK_FACE_PARSE_GDRIVE_ID='154JgKpzCPW82qINcVieuPH3fZ2e0P812'
readonly DIRECTOR_MUSETALK_RESNET18_URL='https://download.pytorch.org/models/resnet18-5c106cde.pth'
