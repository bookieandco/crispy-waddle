import assert from 'node:assert/strict';
import test from 'node:test';
import { LiveGameWatcher } from './live-game-watcher.js';

test('deduplicates observations and preserves source chronology', () => {
  const watcher = new LiveGameWatcher();
  watcher.ingestObservation({ observationId: 'o2', eventId: 'g1', sourceId: 'video', observedAt: '2026-09-03T12:00:02Z', sourceTimestamp: 2, kind: 'TRACK', text: 'Player X moved left', confidence: 0.9, evidenceIds: ['f2'] });
  watcher.ingestObservation({ observationId: 'o1', eventId: 'g1', sourceId: 'video', observedAt: '2026-09-03T12:00:01Z', sourceTimestamp: 1, kind: 'DETECTION', text: 'Player X detected', confidence: 0.95, evidenceIds: ['f1'] });
  assert.equal(watcher.ingestObservation({ observationId: 'o1', eventId: 'g1', sourceId: 'video', observedAt: '2026-09-03T12:00:01Z', sourceTimestamp: 1, kind: 'DETECTION', text: 'duplicate', confidence: 0.1 }), null);
  assert.deepEqual(watcher.getNotes('g1').map((note) => note.noteId), ['obs:o1', 'obs:o2']);
});

test('keeps observations separate from explicit inference and hypothesis', () => {
  const watcher = new LiveGameWatcher();
  watcher.ingestObservation({ observationId: 'o1', eventId: 'g1', sourceId: 'feed', observedAt: '2026-09-03T12:00:01Z', sourceTimestamp: 1, kind: 'DETECTION', text: 'Defender switched', confidence: 0.95 });
  const hypothesis = watcher.addInterpretation({ noteId: 'h1', eventId: 'g1', sourceId: 'director', observedAt: '2026-09-03T12:00:02Z', sourceTimestamp: 2, type: 'HYPOTHESIS', text: 'Defense may keep targeting this matchup', subjectIds: ['defender-7'], evidenceIds: ['f1'], confidence: 0.7, derivedFromObservationIds: ['o1'] });
  assert.equal(hypothesis.type, 'HYPOTHESIS');
  assert.equal(watcher.getNotes('g1')[0].type, 'OBSERVATION');
});

test('rejects validation that uses evidence from before the hypothesis', () => {
  const watcher = new LiveGameWatcher();
  watcher.ingestObservation({ observationId: 'o1', eventId: 'g1', sourceId: 'feed', observedAt: '2026-09-03T12:00:01Z', sourceTimestamp: 1, kind: 'DETECTION', text: 'Switch observed', confidence: 1 });
  watcher.ingestObservation({ observationId: 'o2', eventId: 'g1', sourceId: 'feed', observedAt: '2026-09-03T12:00:03Z', sourceTimestamp: 3, kind: 'DETECTION', text: 'Switch repeated', confidence: 1 });
  watcher.addInterpretation({ noteId: 'h1', eventId: 'g1', sourceId: 'director', observedAt: '2026-09-03T12:00:02Z', sourceTimestamp: 2, type: 'HYPOTHESIS', text: 'Switching will continue', subjectIds: [], evidenceIds: [], confidence: 0.6, derivedFromObservationIds: ['o1'] });
  assert.throws(() => watcher.validateHypothesis('h1', { noteId: 'v1', eventId: 'g1', sourceId: 'director', observedAt: '2026-09-03T12:00:02Z', sourceTimestamp: 1, text: 'consistent', subjectIds: [], evidenceIds: ['f1'], confidence: 0.8, derivedFromObservationIds: ['o1'] }));
  const result = watcher.validateHypothesis('h1', { noteId: 'v2', eventId: 'g1', sourceId: 'director', observedAt: '2026-09-03T12:00:03Z', sourceTimestamp: 3, text: 'confirmed by repeated switch', subjectIds: [], evidenceIds: ['f2'], confidence: 0.9, derivedFromObservationIds: ['o2'] });
  assert.equal(result.status, 'SUPPORTED');
});

test('fails closed on cross-event interpretations', () => {
  const watcher = new LiveGameWatcher();
  watcher.ingestObservation({ observationId: 'o1', eventId: 'g1', sourceId: 'feed', observedAt: '2026-09-03T12:00:01Z', sourceTimestamp: 1, kind: 'DETECTION', text: 'Player detected', confidence: 0.9 });
  assert.throws(() => watcher.addInterpretation({ noteId: 'h1', eventId: 'g2', sourceId: 'director', observedAt: '2026-09-03T12:00:02Z', sourceTimestamp: 2, type: 'HYPOTHESIS', text: 'Hypothesis', subjectIds: [], evidenceIds: [], confidence: 0.5, derivedFromObservationIds: ['o1'] }));
});
