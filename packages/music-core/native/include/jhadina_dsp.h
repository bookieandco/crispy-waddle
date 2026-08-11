#pragma once

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct jhadina_dsp_config {
  double sample_rate_hz;
  uint32_t channels;
  uint32_t max_frames;
  double max_true_peak_dbtp;
} jhadina_dsp_config;

typedef struct jhadina_dsp_metrics {
  float peak_before;
  float peak_after;
  uint32_t frames_processed;
  uint32_t channels_processed;
} jhadina_dsp_metrics;

/* Returns an opaque engine handle, or NULL on invalid configuration. */
void *jhadina_dsp_create(const jhadina_dsp_config *config);

/* Processes interleaved float32 PCM. Must be realtime-safe after create. */
int32_t jhadina_dsp_process(void *engine, const float *input, float *output,
                            uint32_t frames, jhadina_dsp_metrics *metrics);

void jhadina_dsp_reset(void *engine);
void jhadina_dsp_destroy(void *engine);

#ifdef __cplusplus
}
#endif
