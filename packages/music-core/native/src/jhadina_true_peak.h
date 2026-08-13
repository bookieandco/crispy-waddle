#pragma once

#include <stdint.h>

/* 4x linear interpolation estimate for inter-sample peak detection. */
float jhadina_estimate_true_peak_4x(const float *interleaved, uint32_t frames, uint32_t channels);
