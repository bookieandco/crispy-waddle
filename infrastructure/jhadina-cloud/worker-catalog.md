# Jhadina worker catalog

CLOUD.7 makes worker images deployment-owned. Domain code chooses semantic work;
it cannot supply an arbitrary container image.

## Required semantic profiles

| Profile | Intended worker |
| --- | --- |
| `jllm.inference` | local JLLM/model serving |
| `character.runtime` | persistent AI character inference |
| `creative.image` | ComfyUI/local image generation |
| `creative.video` | local video generation/replacement |
| `creative.voice` | TTS/voice performance |
| `creative.audio` | music/audio generation |
| `creative.foley` | Foley/SFX generation/retrieval |
| `media.render` | Director final render |
| `media.transcode` | FFmpeg/proxy/transcode |
| `media.3d` | Blender/3D/product generation |
| `training.lora` | character/product LoRA training |
| `memory.embedding` | embedding generation |
| `memory.index` | semantic index maintenance |
| `analysis.batch` | Money/SHARK/Sports/Opportunity batch intelligence |

Existing repo workers remain candidates behind these profiles, including
`services/studio-render`, `services/voice-sync`,
`services/director-character-training`, Director tracking/rig/replacement
services and Pupson background-removal/upscale services.

## Live-image rule

Shadow mode may use an unpinned development image. Live submission requires an
immutable image digest. Worker catalog resolution fails closed when the digest
is missing or the workload kind does not match the profile.

## Consequential domain effects

The catalog does not contain a `money.trade.submit`, `shark.trade`, betting,
payment, publishing or other consequential provider executor.

Compute may accelerate research/simulation for those systems. Their real effect
continues through the canonical domain Action Core/executor boundary.
