#pragma once
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct jhadina_eq_params { double frequency_hz; double gain_db; double q; } jhadina_eq_params;
typedef struct jhadina_peaking_eq_state { float b0,b1,b2,a1,a2,z1,z2; } jhadina_peaking_eq_state;
int32_t jhadina_dsp_set_peaking_eq(void *engine, const jhadina_eq_params *params);
int32_t jhadina_peaking_eq_prepare(jhadina_peaking_eq_state *state, double sample_rate_hz, const jhadina_eq_params *params);
void jhadina_peaking_eq_process(jhadina_peaking_eq_state *state, const float *input, float *output, uint32_t frames, uint32_t channels);
#ifdef __cplusplus
}
#endif
