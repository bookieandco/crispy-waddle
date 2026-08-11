#include "jhadina_true_peak.h"

#include <algorithm>
#include <cmath>

float jhadina_estimate_true_peak_4x(const float *interleaved, uint32_t frames, uint32_t channels) {
  if (!interleaved || frames == 0 || channels == 0) return 0.0f;
  float peak = 0.0f;
  for (uint32_t frame = 0; frame < frames; ++frame) {
    for (uint32_t ch = 0; ch < channels; ++ch) {
      const float current = interleaved[frame * channels + ch];
      peak = std::max(peak, std::fabs(current));
      if (frame + 1 >= frames) continue;
      const float next = interleaved[(frame + 1) * channels + ch];
      for (int phase = 1; phase < 4; ++phase) {
        const float t = static_cast<float>(phase) / 4.0f;
        peak = std::max(peak, std::fabs(current + (next - current) * t));
      }
    }
  }
  return peak;
}
