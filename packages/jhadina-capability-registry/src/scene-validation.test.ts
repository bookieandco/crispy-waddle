import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateScene } from './scene-validation.js';

describe('scene validation', () => {
  it('accepts a bounded scene', () => {
    const result = validateScene({ id: 'movie-night', version: 1, actions: [
      { id: 'power', capability: 'remote.power', payload: { value: true } },
      { id: 'wait', type: 'delay', milliseconds: 1000 },
      { id: 'on', type: 'assert-state', payload: { state: 'on' } },
    ] });
    assert.equal(result.valid, true);
  });

  it('rejects unbounded action counts, delays, runtime and oversized payloads', () => {
    const result = validateScene({ id: 'safe', version: 1, estimatedRuntimeMs: 1000, actions: [
      ...Array.from({ length: 3 }, (_, i) => ({ id: `a${i}`, capability: 'remote.power' })),
      { id: 'delay', type: 'delay', milliseconds: 1000 },
      { id: 'huge', capability: 'remote.power', payload: 'x'.repeat(100) },
    ] }, { maxActions: 4, maxDelayMs: 500, maxRuntimeMs: 500, maxPayloadBytes: 32 });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes('action limit')));
    assert.ok(result.errors.some(error => error.includes('delay limit')));
    assert.ok(result.errors.some(error => error.includes('payload limit')));
    assert.ok(result.errors.some(error => error.includes('runtime limit')));
  });

  it('rejects duplicate ids and malformed actions', () => {
    const result = validateScene({ id: 'scene', version: 0, actions: [
      { id: 'same', capability: 'remote.power' },
      { id: 'same' },
      { id: 'bad-delay', type: 'delay', milliseconds: -1 },
      { id: 'bad-state', type: 'assert-state' },
    ] });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes('duplicate')));
    assert.ok(result.errors.some(error => error.includes('invalid delay')));
    assert.ok(result.errors.some(error => error.includes('missing state assertion')));
  });
});
