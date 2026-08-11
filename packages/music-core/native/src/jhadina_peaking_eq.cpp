#include "jhadina_eq.h"
#include <algorithm>
#include <cmath>
#include <cstdint>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

struct jhadina_peaking_eq_state {
  float b0, b1, b2, a1, a2, z1, z2;
};

extern "C" int32_t jhadina_peaking_eq_prepare(jhadina_peaking_eq_state *s, double sample_rate_hz, const jhadina_eq_params *p) {
  if (!s || !p || !std::isfinite(sample_rate_hz) || !std::isfinite(p->frequency_hz) || !std::isfinite(p->gain_db) || !std::isfinite(p->q)) return -1;
  if (sample_rate_hz <= 0 || p->frequency_hz <= 0 || p->frequency_hz >= sample_rate_hz * 0.49 || p->q <= 0 || p->q > 20 || p->gain_db < -24 || p->gain_db > 24) return -2;
  const double A = std::pow(10.0, p->gain_db / 40.0);
  const double w = 2.0 * M_PI * p->frequency_hz / sample_rate_hz;
  const double alpha = std::sin(w) / (2.0 * p->q);
  const double c = std::cos(w);
  const double a0 = 1.0 + alpha / A;
  s->b0 = static_cast<float>((1.0 + alpha * A) / a0);
  s->b1 = static_cast<float>((-2.0 * c) / a0);
  s->b2 = static_cast<float>((1.0 - alpha * A) / a0);
  s->a1 = static_cast<float>((-2.0 * c) / a0);
  s->a2 = static_cast<float>((1.0 - alpha / A) / a0);
  s->z1 = s->z2 = 0.0f;
  return 0;
}

extern "C" void jhadina_peaking_eq_process(jhadina_peaking_eq_state *s, const float *input, float *output, uint32_t frames, uint32_t channels) {
  if (!s || !input || !output || frames == 0 || channels == 0) return;
  for (uint64_t i = 0, n = uint64_t(frames) * channels; i < n; ++i) {
    const float x = input[i];
    const float y = s->b0 * x + s->z1;
    s->z1 = s->b1 * x - s->a1 * y + s->z2;
    s->z2 = s->b2 * x - s->a2 * y;
    output[i] = y;
  }
}
