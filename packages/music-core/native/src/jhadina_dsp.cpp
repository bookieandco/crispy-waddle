#include "jhadina_dsp.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <new>

struct JhadinaDsp {
  jhadina_dsp_config config{};
};

extern "C" void *jhadina_dsp_create(const jhadina_dsp_config *config) {
  if (!config || config->sample_rate_hz <= 0 || config->channels == 0 || config->max_frames == 0) {
    return nullptr;
  }
  auto *engine = new (std::nothrow) JhadinaDsp{};
  if (!engine) return nullptr;
  engine->config = *config;
  return engine;
}

extern "C" int32_t jhadina_dsp_process(void *opaque, const float *input, float *output,
                                        uint32_t frames, jhadina_dsp_metrics *metrics) {
  if (!opaque || !input || !output || frames == 0) return -1;
  auto *engine = static_cast<JhadinaDsp *>(opaque);
  if (frames > engine->config.max_frames) return -2;

  float before = 0.0f;
  float after = 0.0f;
  const uint64_t samples = static_cast<uint64_t>(frames) * engine->config.channels;
  for (uint64_t i = 0; i < samples; ++i) {
    const float x = input[i];
    before = std::max(before, std::fabs(x));
    // Kernel scaffold: transparent pass-through. DSP stages are added behind this ABI.
    output[i] = x;
    after = std::max(after, std::fabs(output[i]));
  }

  if (metrics) {
    metrics->peak_before = before;
    metrics->peak_after = after;
    metrics->frames_processed = frames;
    metrics->channels_processed = engine->config.channels;
  }
  return 0;
}

extern "C" void jhadina_dsp_reset(void *opaque) {
  (void)opaque;
}

extern "C" void jhadina_dsp_destroy(void *opaque) {
  delete static_cast<JhadinaDsp *>(opaque);
}
