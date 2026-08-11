#pragma once
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif

typedef struct jhadina_eq_params {
  double frequency_hz;
  double gain_db;
  double q;
} jhadina_eq_params;

int32_t jhadina_dsp_set_peaking_eq(void *engine, const jhadina_eq_params *params);
#ifdef __cplusplus
}
#endif
