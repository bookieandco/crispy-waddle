#include "jhadina_dsp.h"
#include "jhadina_true_peak.h"

#include <algorithm>
#include <cmath>
#include <new>

struct JhadinaDsp {
  jhadina_dsp_config config{};
  jhadina_dsp_params params{0.0, 0.0};
  float gain_linear{1.0f};
};

static float db_to_linear(double db) {
  return static_cast<float>(std::pow(10.0, db / 20.0));
}

extern "C" void *jhadina_dsp_create(const jhadina_dsp_config *config) {
  if (!config || config->sample_rate_hz <= 0 || config->channels == 0 || config->max_frames == 0) return nullptr;
  auto *engine = new (std::nothrow) JhadinaDsp{};
  if (!engine) return nullptr;
  engine->config = *config;
  engine->params.ceiling_dbfs = config->max_true_peak_dbtp;
  return engine;
}

extern "C" int32_t jhadina_dsp_set_params(void *opaque, const jhadina_dsp_params *params) {
  if (!opaque || !params || !std::isfinite(params->gain_db) || !std::isfinite(params->ceiling_dbfs)) return -1;
  auto *engine = static_cast<JhadinaDsp *>(opaque);
  if (params->gain_db < -60.0 || params->gain_db > 24.0) return -2;
  if (params->ceiling_dbfs > 0.0 || params->ceiling_dbfs < -60.0) return -3;
  engine->params = *params;
  engine->gain_linear = db_to_linear(params->gain_db);
  return 0;
}

extern "C" int32_t jhadina_dsp_process(void *opaque, const float *input, float *output,
                                        uint32_t frames, jhadina_dsp_metrics *metrics) {
  if (!opaque || !input || !output || frames == 0) return -1;
  auto *engine = static_cast<JhadinaDsp *>(opaque);
  if (frames > engine->config.max_frames) return -2;

  float before = 0.0f;
  const uint64_t samples = static_cast<uint64_t>(frames) * engine->config.channels;
  for (uint64_t i = 0; i < samples; ++i) before = std::max(before, std::fabs(input[i]));

  const float trueBefore = jhadina_estimate_true_peak_4x(input, frames, engine->config.channels);
  const float requestedPeak = trueBefore * engine->gain_linear;
  const float ceiling = db_to_linear(engine->params.ceiling_dbfs);
  const float limiterGain = requestedPeak > ceiling && requestedPeak > 0.0f ? ceiling / requestedPeak : 1.0f;
  const float totalGain = engine->gain_linear * limiterGain;

  float after = 0.0f;
  for (uint64_t i = 0; i < samples; ++i) {
    const float processed = input[i] * totalGain;
    output[i] = std::clamp(processed, -ceiling, ceiling);
    after = std::max(after, std::fabs(output[i]));
  }
  const float trueAfter = jhadina_estimate_true_peak_4x(output, frames, engine->config.channels);

  if (metrics) {
    metrics->peak_before = before;
    metrics->peak_after = after;
    metrics->true_peak_before = trueBefore;
    metrics->true_peak_after = trueAfter;
    metrics->frames_processed = frames;
    metrics->channels_processed = engine->config.channels;
    metrics->true_peak_limited = limiterGain < 0.999999f ? 1 : 0;
  }
  return 0;
}

extern "C" void jhadina_dsp_reset(void *opaque) {
  if (!opaque) return;
  auto *engine = static_cast<JhadinaDsp *>(opaque);
  engine->params = {0.0, engine->config.max_true_peak_dbtp};
  engine->gain_linear = 1.0f;
}

extern "C" void jhadina_dsp_destroy(void *opaque) {
  delete static_cast<JhadinaDsp *>(opaque);
}
