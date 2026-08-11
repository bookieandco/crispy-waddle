#include "jhadina_mastering_bridge.h"
#include "jhadina_dsp.h"
#include "jhadina_eq.h"

extern "C" int32_t jhadina_dsp_apply_mastering_step(void *engine, const jhadina_mastering_step *step) {
  if (!engine || !step) return -1;

  if (step->operation == 0) {
    const jhadina_eq_band band{step->frequency_hz, step->gain_db, step->q};
    return jhadina_dsp_add_peaking_eq(engine, &band);
  }

  if (step->operation == 1) {
    jhadina_dsp_params params{};
    params.gain_db = 0.0;
    params.ceiling_dbfs = step->ceiling_dbtp;
    return jhadina_dsp_set_params(engine, &params);
  }

  return -2;
}
