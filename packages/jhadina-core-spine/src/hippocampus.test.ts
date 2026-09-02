import assert from 'node:assert/strict';
import { encodeHippocampalEpisode, retrieveRelatedEpisodes } from './hippocampus.js';
import type { Experience } from './types.js';

const experience: Experience = {
  id: 'exp-1',
  occurredAt: '2026-09-02T14:00:00.000Z',
  source: 'conversation',
  domain: 'personality',
  actor: 'user',
  content: 'I prefer direct answers with a little humor.',
  evidence: [],
};

describe('Hippocampus', () => {
  it('encodes an Experience without changing its authority', () => {
    const episode = encodeHippocampalEpisode(experience);
    assert.equal(episode.episodeId, experience.id);
    assert.equal(episode.actor, 'user');
    assert.ok(episode.indexedTerms.includes('direct'));
    assert.ok(episode.indexedTerms.includes('humor'));
  });

  it('retrieves related episodes deterministically', () => {
    const first = encodeHippocampalEpisode(experience);
    const second = encodeHippocampalEpisode({ ...experience, id: 'exp-2', occurredAt: '2026-09-02T15:00:00.000Z', content: 'I prefer concise direct answers.' });
    const result = retrieveRelatedEpisodes([first, second], 'direct answers');
    assert.deepEqual(result.map((episode) => episode.episodeId), ['exp-2', 'exp-1']);
  });

  it('rejects empty experiences', () => {
    assert.throws(() => encodeHippocampalEpisode({ ...experience, content: ' ' }), /content must not be empty/);
  });
});
