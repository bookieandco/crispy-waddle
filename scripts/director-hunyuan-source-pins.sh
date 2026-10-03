#!/usr/bin/env bash
# Canonical immutable source pins for Director HunyuanVideo-1.5 production bootstrap.
# Upgrades require an explicit repository change and recertification.

readonly DIRECTOR_HUNYUAN_CODE_SOURCE='https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5.git'
readonly DIRECTOR_HUNYUAN_CODE_REVISION='60783e704160023913bee78f0b47036d393d4dfa'

readonly DIRECTOR_HUNYUAN_MODEL_SOURCE='tencent/HunyuanVideo-1.5'
readonly DIRECTOR_HUNYUAN_MODEL_REVISION='9b49404b3f5df2a8f0b31df27a0c7ab872e7b038'

readonly DIRECTOR_HUNYUAN_QWEN_SOURCE='Qwen/Qwen2.5-VL-7B-Instruct'
readonly DIRECTOR_HUNYUAN_QWEN_REVISION='cc594898137f460bfe9f0759e9844b3ce807cfb5'

readonly DIRECTOR_HUNYUAN_BYT5_SOURCE='google/byt5-small'
readonly DIRECTOR_HUNYUAN_BYT5_REVISION='68377bdc18a2ffec8a0533fef03b1c513a4dd49d'

# Public immutable duplicate of the Glyph-SDXL-v2 model tree. The upstream
# ModelScope CLI supports --revision, but the public ModelScope model currently
# exposes a moving master. Pinning the public HF duplicate prevents silent drift.
readonly DIRECTOR_HUNYUAN_GLYPH_SOURCE='Alptekinege/Glyph-SDXL-v2'
readonly DIRECTOR_HUNYUAN_GLYPH_REVISION='66554fd5dda49d26bba4fd9a7e2519fc5e990739'

readonly DIRECTOR_HUNYUAN_SIGLIP_SOURCE='google/siglip-so400m-patch14-384'
readonly DIRECTOR_HUNYUAN_SIGLIP_REVISION='538da78b54e0d958422c4b1d5562a21595f4adce'
