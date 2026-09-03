import assert from 'node:assert/strict';
import test from 'node:test';
import { PlayerAttributeEngine, playerSliderDefinitions, resolvePlayerMatchup } from './player-attributes.js';

test('provides sport-specific sliders on a shared cross-sport foundation', () => {
  for (const sport of ['NBA', 'NFL', 'MLB', 'NHL', 'SOCCER', 'TENNIS'] as const) {
    const keys = new Set(playerSliderDefinitions(sport).map((item) => item.key));
    assert(keys.has('athleticism'));
    assert(keys.has('decision_making'));
    assert(keys.size > 15);
  }
  assert(playerSliderDefinitions('NBA').some((item) => item.key === 'three_point'));
  assert(playerSliderDefinitions('NFL').some((item) => item.key === 'route_running'));
  assert(playerSliderDefinitions('MLB').some((item) => item.key === 'pitch_velocity'));
  assert(playerSliderDefinitions('NHL').some((item) => item.key === 'puck_control'));
  assert(playerSliderDefinitions('SOCCER').some((item) => item.key === 'first_touch'));
  assert(playerSliderDefinitions('TENNIS').some((item) => item.key === 'serve_power'));
});

test('recent evidence updates the player profile without turning one play into certainty', () => {
  const engine = new PlayerAttributeEngine();
  engine.addEvidence({ evidenceId: 'e1', eventId: 'g1', playerId: 'c', attribute: 'finishing', value: 78, weight: 1, observedAt: '2026-08-01T00:00:00Z', provenance: 'OFFICIAL' });
  engine.addEvidence({ evidenceId: 'e2', eventId: 'g2', playerId: 'c', attribute: 'finishing', value: 95, weight: 1, observedAt: '2026-08-30T00:00:00Z', provenance: 'VIDEO_ATTRIBUTION' });
  const profile = engine.buildProfile('c', 'NBA', '2026-09-01T00:00:00Z');
  assert(profile.attributes.finishing.mean > 78);
  assert(profile.attributes.finishing.mean < 95);
  assert(profile.attributes.finishing.uncertainty > 0);
  assert.equal(profile.attributes.finishing.sampleSize, 2);
});

test('contextual resolver keeps recent form and matchup as simulation inputs', () => {
  const engine = new PlayerAttributeEngine();
  engine.addEvidence({ evidenceId: 'c1', eventId: 'g1', playerId: 'c', attribute: 'finishing', value: 85, weight: 10, observedAt: '2026-08-31T00:00:00Z', provenance: 'OFFICIAL' });
  engine.addEvidence({ evidenceId: 'o1', eventId: 'g2', playerId: 'o', attribute: 'finishing', value: 70, weight: 10, observedAt: '2026-08-31T00:00:00Z', provenance: 'OFFICIAL' });
  const c = engine.resolve('c', 'NBA', { asOf: '2026-09-01T00:00:00Z', fatigue: 10, pressure: 50, recentForm: 90, matchupAdjustment: 12 });
  const o = engine.resolve('o', 'NBA', { asOf: '2026-09-01T00:00:00Z', fatigue: 10, pressure: 50, recentForm: 50, matchupAdjustment: 0 });
  assert(c.sliders.finishing.value > 85);
  assert(c.sliders.finishing.components.RECENT_FORM > 0);
  const matchup = resolvePlayerMatchup({ playerId: 'c', opponentId: 'o', playerState: c, opponentState: o });
  assert(matchup.adjustments.finishing > 0);
  assert(matchup.uncertainty >= 0);
});

test('future evidence cannot leak into an as-of profile', () => {
  const engine = new PlayerAttributeEngine();
  engine.addEvidence({ evidenceId: 'old', eventId: 'g1', playerId: 'c', attribute: 'three_point', value: 80, weight: 1, observedAt: '2026-08-01T00:00:00Z', provenance: 'OFFICIAL' });
  engine.addEvidence({ evidenceId: 'future', eventId: 'g2', playerId: 'c', attribute: 'three_point', value: 100, weight: 1, observedAt: '2026-09-05T00:00:00Z', provenance: 'OFFICIAL' });
  const profile = engine.buildProfile('c', 'NBA', '2026-09-01T00:00:00Z');
  assert.equal(profile.attributes.three_point.sampleSize, 1);
  assert.deepEqual(profile.attributes.three_point.evidenceIds, ['old']);
});
