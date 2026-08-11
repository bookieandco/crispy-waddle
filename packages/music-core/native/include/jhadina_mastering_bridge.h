#pragma once
#include <stdint.h>
#include "jhadina_eq.h"
#ifdef __cplusplus
extern "C" {
#endif

typedef struct jhadina_mastering_step {
  int32_t operation; /* 0=eq, 1=limiter */
  double frequency_hz;
  double gain_db;
  double q;
  double ceiling_dbtp;
} jhadina_mastering_step;

int32_t jhadina_dsp_apply_mastering_step(void *engine, const jhadina_mastering_step *step);
#ifdef __cplusplus
}
#endif
