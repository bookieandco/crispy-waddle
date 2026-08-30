import { RealCore } from './real-core.js';

const evidence = [{ id: 'e1', source: 'test', observedAt: '2026-08-30T00:00:00Z', summary: 'Observed behavior' }];

test('preserves identity and creates continuity from experience', () => {
  const core = new RealCore();
  const result = core.observe({
    id: 'x1',
    occurredAt: '2026-08-30T00:00:00Z',
    source: 'user',
    content: 'Build this now',
    significance: 'high',
    context: ['real-core'],
    evidence,
  });

  if (result.state.identity.name !== 'Jhadina') throw new Error('identity was not preserved');
  if (!result.state.recentExperiences.includes('x1')) throw new Error('experience was not retained');
  if (result.state.attention.priority !== 'P1') throw new Error('high-significance experience did not get priority');
  if (result.stance !== 'support') throw new Error('support stance was not derived');
});

test('forms evidence-backed opinions and preferences', () => {
  const core = new RealCore();
  core.formOpinion({ statement: 'Verify before deploying', evidence, confidence: 0.9, at: '2026-08-30T00:00:00Z' });
  core.learnPreference('Prefer reversible changes first', evidence, '2026-08-30T00:00:00Z');
  const state = core.snapshot();

  if (state.opinions.length !== 1 || state.opinions[0]?.confidence !== 0.9) throw new Error('opinion state is incorrect');
  if (state.preferences.length !== 1) throw new Error('preference state is incorrect');
});

test('does not mistake every interaction for a speaking turn', () => {
  const core = new RealCore();
  const result = core.observe({ id: 'x2', occurredAt: '2026-08-30T00:00:00Z', source: 'system', content: 'heartbeat received', significance: 'low' });
  if (result.shouldSpeak) throw new Error('low-significance observation should not force speech');
  if (result.stance !== 'observe') throw new Error('passive observation should remain observe');
});
