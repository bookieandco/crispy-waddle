import test from 'node:test';
import assert from 'node:assert/strict';
import {forecastSignalDisagreement} from './worker.mjs';

const baseline={
 model_id:'baseline-v1',
 home_win_probability:0.74,away_win_probability:0.26,draw_probability:0,
 home_projected_points:103,away_projected_points:98,score_unit:'points'
};
test('new coherent winner and projected-score direction passes',()=>{
 assert.equal(forecastSignalDisagreement(baseline),false);
 assert.equal(forecastSignalDisagreement({...baseline,home_win_probability:0.24,away_win_probability:0.76,
  home_projected_points:97,away_projected_points:107}),false);
});
test('clear opposite probability/score direction is quarantined rather than sealed',()=>{
 assert.equal(forecastSignalDisagreement({...baseline,home_projected_points:94,away_projected_points:103}),true);
 assert.equal(forecastSignalDisagreement({...baseline,home_win_probability:0.26,away_win_probability:0.74}),true);
});
test('minor modeling disagreements under published thresholds are not spuriously rejected',()=>{
 assert.equal(forecastSignalDisagreement({...baseline,home_win_probability:0.51,away_win_probability:0.49,
  home_projected_points:99,away_projected_points:103}),false);
 assert.equal(forecastSignalDisagreement({...baseline,home_projected_points:99,away_projected_points:99.4}),false);
});
test('match winner 1/0 indicators are never mistaken for game score projections',()=>{
 assert.equal(forecastSignalDisagreement({...baseline,score_unit:'match_win_indicator',
  home_projected_points:0.2,away_projected_points:0.8}),false);
});
test('missing or nonfinite source signal does not invent a contradiction',()=>{
 assert.equal(forecastSignalDisagreement(null),false);
 assert.equal(forecastSignalDisagreement({...baseline,home_win_probability:NaN}),false);
});
