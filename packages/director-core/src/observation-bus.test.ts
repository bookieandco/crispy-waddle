import { describe, expect, it } from 'vitest';
import { InMemoryObservationBus } from './observation-bus.js';
import { createCvatAdapter, createEssentiaAdapter, createHumanAdapter, createSenseVoiceAdapter, createWhisperAdapter } from './observation-providers.js';

describe('Observation Bus', () => {
  it('normalizes vision, transcript, and audio providers into one queryable stream', async () => {
    const bus = new InMemoryObservationBus();
    const vision = await createCvatAdapter().analyze({ assetId: 'asset-1', observations: [{ id: 'v1', startSeconds: 1, endSeconds: 3, label: 'person' }] });
    const browserVision = await createHumanAdapter().analyze({ assetId: 'asset-1', observations: [{ id: 'h1', startSeconds: 2, endSeconds: 4, label: 'face' }] });
    const whisper = await createWhisperAdapter().analyze({ assetId: 'asset-1', segments: [{ id: 'w1', startSeconds: 2, endSeconds: 4, text: 'hello' }] });
    const sense = await createSenseVoiceAdapter().analyze({ assetId: 'asset-1', segments: [{ id: 's1', startSeconds: 4, endSeconds: 5, text: 'bonjour' }] });
    const audio = await createEssentiaAdapter().analyze({ assetId: 'asset-1', events: [{ id: 'a1', startSeconds: 2, endSeconds: 3, kind: 'music', label: 'beat' }] });
    await bus.publish([...vision, ...browserVision, ...whisper, ...sense, ...audio]);

    expect(bus.query({ assetId: 'asset-1' })).toHaveLength(5);
    expect(bus.query({ modalities: ['vision'] }).map(item => item.label)).toEqual(['person', 'face']);
    expect(bus.query({ text: 'hello' })[0]?.source).toBe('whisper');
    expect(bus.query({ kinds: ['music'] })[0]?.source).toBe('essentia');
  });
});
