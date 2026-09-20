import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { verifyFreshCulturalReference } from './cultural-freshness.js';

const DAY = 24 * 60 * 60 * 1000;
const now = '2026-09-19T20:00:00.000Z';

describe('cultural freshness gate', () => {
  it('verifies a reference only from matching fresh Knowledge evidence', () => {
    const verified = verifyFreshCulturalReference({
      reference: 'Neon Samurai',
      now,
      freshnessWindowMs: 7 * DAY,
      knowledge: [{
        id: 'knowledge-1',
        source: 'news-index',
        observedAt: '2026-09-18T20:00:00.000Z',
        summary: 'Neon Samurai released a new trailer this week.',
        immutable: true,
      }],
    });

    assert.ok(verified);
    assert.equal(verified.value, 'Neon Samurai');
    assert.deepEqual(verified.evidence.map((ref) => ref.id), ['knowledge-1']);
  });

  it('rejects unrelated evidence even when it is fresh', () => {
    const verified = verifyFreshCulturalReference({
      reference: 'Neon Samurai',
      now,
      freshnessWindowMs: 7 * DAY,
      knowledge: [{
        id: 'knowledge-unrelated',
        source: 'news-index',
        observedAt: '2026-09-18T20:00:00.000Z',
        summary: 'A different show released a trailer.',
        immutable: true,
      }],
    });

    assert.equal(verified, undefined);
  });

  it('rejects stale evidence', () => {
    const verified = verifyFreshCulturalReference({
      reference: 'Neon Samurai',
      now,
      freshnessWindowMs: 7 * DAY,
      knowledge: [{
        id: 'knowledge-stale',
        source: 'news-index',
        observedAt: '2026-08-01T20:00:00.000Z',
        summary: 'Neon Samurai had an announcement.',
        immutable: true,
      }],
    });

    assert.equal(verified, undefined);
  });

  it('rejects future-dated evidence', () => {
    const verified = verifyFreshCulturalReference({
      reference: 'Neon Samurai',
      now,
      freshnessWindowMs: 7 * DAY,
      knowledge: [{
        id: 'knowledge-future',
        source: 'news-index',
        observedAt: '2026-09-20T20:00:00.000Z',
        summary: 'Neon Samurai has a future announcement.',
        immutable: true,
      }],
    });

    assert.equal(verified, undefined);
  });

  it('requires an explicit valid freshness policy', () => {
    assert.throws(
      () => verifyFreshCulturalReference({
        reference: 'Neon Samurai',
        now: 'not-a-date',
        freshnessWindowMs: DAY,
        knowledge: [],
      }),
      /valid timestamp/,
    );
    assert.throws(
      () => verifyFreshCulturalReference({
        reference: 'Neon Samurai',
        now,
        freshnessWindowMs: 0,
        knowledge: [],
      }),
      /greater than 0/,
    );
  });
});
