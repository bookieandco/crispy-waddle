import { describe, expect, it } from 'vitest';
import type { Experience, HippocampalEpisode } from '@jhadina/core-spine';
import { HippocampalEpisodePatternAdapter } from './hippocampal-episode-pattern-adapter';

const current: Experience = {
  id: 'live-1',
  occurredAt: '2026-09-20T12:00:00.000Z',
  source: 'ask-jhadina',
  actor: 'user',
  content: 'Keep this direct.',
  evidence: [{ id: 'live-1', source: 'ask-jhadina', observedAt: '2026-09-20T12:00:00.000Z', summary: 'Keep this direct.', immutable: false }],
};

const episode: HippocampalEpisode = {
  episodeId: 'reason-1',
  occurredAt: '2026-09-19T12:00:00.000Z',
  source: 'ask-jhadina',
  actor: 'user',
  content: 'Keep answers direct.',
  evidence: [{ id: 'reason-1', source: 'ask-jhadina', observedAt: '2026-09-19T12:00:00.000Z', summary: 'Keep answers direct.', immutable: true }],
};

describe('HippocampalEpisodePatternAdapter provenance', () => {
  it('does not count an episode again when the same lineage already backs a memory term', () => {
    const covered = new Map<string, ReadonlySet<string>>([
      ['direct', new Set(['reason-1'])],
    ]);

    expect(new HippocampalEpisodePatternAdapter().detect(
      current,
      [episode],
      covered,
    )).toEqual([]);
  });

  it('keeps the episode available for a different uncovered term', () => {
    const conciseEpisode: HippocampalEpisode = {
      ...episode,
      content: 'Keep answers direct and concise.',
      evidence: [{ ...episode.evidence[0], summary: 'Keep answers direct and concise.' }],
    };
    const conciseCurrent: Experience = {
      ...current,
      content: 'Keep this direct and concise.',
      evidence: [{ ...current.evidence[0], summary: 'Keep this direct and concise.' }],
    };
    const covered = new Map<string, ReadonlySet<string>>([
      ['direct', new Set(['reason-1'])],
    ]);

    const patterns = new HippocampalEpisodePatternAdapter().detect(
      conciseCurrent,
      [conciseEpisode],
      covered,
    );

    expect(patterns.some((pattern) => pattern.id === 'episodic-recurrence:direct')).toBe(false);
    expect(patterns.some((pattern) => pattern.id === 'episodic-recurrence:concise')).toBe(true);
  });
});
