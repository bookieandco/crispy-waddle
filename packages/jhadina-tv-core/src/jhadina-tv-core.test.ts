import { describe, expect, it, vi } from 'vitest';
import {
  CatalogRegistry,
  assertAuthorizedSource,
  assertCastableSource,
  assertMediaRight,
  assertPlayableSource,
  buildMediaKnowledge,
  buildTransferCommand,
  createCastingManager,
  createDeterministicMediaAdvisor,
  createInMemoryViewingSignalStore,
  createMediaIntelligenceSnapshot,
  createUnifiedMediaSession,
  evidenceForClaim,
  recommendTitles,
  type CatalogProvider,
  type MediaSessionCommand,
  type MediaSource,
  type MediaSessionController,
  type MediaTitle,
} from './index';

const title = (id: string, overrides: Partial<MediaTitle> = {}): MediaTitle => ({
  id, kind: 'movie', title: id, overview: 'A science fiction story', year: 2026,
  genres: ['science fiction'], availability: 'licensed', ...overrides,
});

const provider = (id: string, results: MediaTitle[] = [title('alpha')]): CatalogProvider => ({
  id, name: id,
  sourceAdapter: { id, name: id, search: async () => results, getSources: async () => [] },
  search: async () => results,
});

describe('JhadinaTV production contracts', () => {
  it('rejects duplicate catalog providers and searches selected providers', async () => {
    const registry = new CatalogRegistry();
    registry.register(provider('one'));
    expect(() => registry.register(provider('one'))).toThrow(/already registered/);
    registry.register(provider('two', [title('beta')]));
    await expect(registry.search({ query: 'x', providers: ['two'] })).resolves.toEqual([{ providerId: 'two', title: title('beta') }]);
  });

  it('rejects unknown source providers', async () => {
    const registry = new CatalogRegistry();
    await expect(registry.resolveSources('missing', 'alpha')).rejects.toThrow(/Unknown/);
  });

  it('accepts only valid HTTPS playable sources', () => {
    const source: MediaSource = { id: 's1', titleId: 'alpha', kind: 'hls', url: 'https://media.example/video.m3u8' };
    expect(assertPlayableSource(source)).toBe(source);
    expect(() => assertPlayableSource({ ...source, url: 'http://media.example/video.m3u8' })).toThrow(/HTTPS/);
    expect(() => assertPlayableSource({ ...source, url: 'not-a-url' })).toThrow();
    expect(assertCastableSource(source.url)).toBe(source.url);
  });

  it('keeps HTTPS transport validation separate from authorization', () => {
    const pending: MediaSource = { id: 's2', titleId: 'alpha', kind: 'hls', url: 'https://media.example/video.m3u8', authorization: { status: 'pending' } };
    expect(() => assertAuthorizedSource(pending)).toThrow(/not authorized/);
    const authorized: MediaSource = { ...pending, authorization: { status: 'authorized', expiresAt: '2030-01-01T00:00:00.000Z', rightsEvidenceIds: ['e1'] } };
    expect(assertAuthorizedSource(authorized, new Date('2027-01-01T00:00:00.000Z'))).toBe(authorized);
    expect(() => assertAuthorizedSource({ ...authorized, authorization: { ...authorized.authorization, expiresAt: '2020-01-01T00:00:00.000Z' } }, new Date('2027-01-01T00:00:00.000Z'))).toThrow(/expired/);
  });

  it('rejects authorized sources outside their permitted territory', () => {
    const source: MediaSource = {
      id: 's-territory',
      titleId: 'alpha',
      kind: 'hls',
      url: 'https://media.example/video.m3u8',
      authorization: { status: 'authorized', territories: ['US'] },
    };
    expect(assertAuthorizedSource(source, new Date('2027-01-01T00:00:00.000Z'), 'US')).toBe(source);
    expect(() => assertAuthorizedSource(source, new Date('2027-01-01T00:00:00.000Z'), 'CA')).toThrow(/territory/);
  });

  it('requires explicit scoped rights for media operations', () => {
    const source: MediaSource = {
      id: 's-rights',
      titleId: 'alpha',
      kind: 'hls',
      url: 'https://media.example/video.m3u8',
      authorization: {
        status: 'authorized',
        rights: ['playback', 'casting', 'transcription'],
        rightsEvidenceIds: ['license-1'],
      },
    };
    expect(assertMediaRight(source, 'playback')).toBe(source);
    expect(assertMediaRight(source, 'casting')).toBe(source);
    expect(assertMediaRight(source, 'transcription')).toBe(source);
    expect(() => assertMediaRight(source, 'download')).toThrow(/does not grant download/);
    expect(() => assertMediaRight(source, 'ai-analysis')).toThrow(/does not grant ai-analysis/);
    expect(() => assertMediaRight(source, 'republication')).toThrow(/does not grant republication/);
  });

  it('produces deterministic recommendation ordering and explicit-preference weighting', () => {
    const catalog = [title('zeta'), title('alpha')];
    const request = { query: 'science', signals: [{ titleId: 'alpha', completed: false, progressMinutes: 2, liked: true, kind: 'explicit-preference' as const }] };
    const first = recommendTitles(catalog, request);
    const second = recommendTitles([...catalog].reverse(), request);
    expect(first.map((item) => item.title.id)).toEqual(second.map((item) => item.title.id));
    expect(first[0]?.title.id).toBe('alpha');
  });

  it('records viewing signals without turning them into execution authority', () => {
    const store = createInMemoryViewingSignalStore();
    store.record({ titleId: 'alpha', completed: false, progressMinutes: 10, kind: 'observed-behavior', observedAt: '2026-09-12T00:00:00Z' });
    store.record({ titleId: 'alpha', completed: true, progressMinutes: 100, kind: 'explicit-preference', liked: true });
    expect(store.list()).toEqual([{ titleId: 'alpha', completed: true, progressMinutes: 100, kind: 'explicit-preference', observedAt: '2026-09-12T00:00:00Z', liked: true }]);
  });

  it('builds evidence-backed media knowledge with stable ordering', () => {
    const knowledge = buildMediaKnowledge({
      media: title('alpha'),
      evidence: [
        { id: 'e2', kind: 'subtitle', sourceId: 'sub', observedAt: '2026-09-12T00:00:01Z', confidence: 'medium' },
        { id: 'e1', kind: 'catalog', sourceId: 'catalog', observedAt: '2026-09-12T00:00:00Z', confidence: 'high' },
      ],
      entities: [' Ripley ', 'ripley', ''],
      scenes: [
        { id: 's2', mediaId: 'alpha', startSeconds: 20, label: 'escape', entities: ['ripley'], evidenceIds: ['e2'], confidence: 'medium' },
        { id: 's1', mediaId: 'alpha', startSeconds: 5, label: 'arrival', entities: [], evidenceIds: ['e1'], confidence: 'high' },
      ],
    }, '2026-09-12T01:00:00Z');
    expect(knowledge.entities).toEqual(['ripley']);
    expect(knowledge.evidence.map((item) => item.id)).toEqual(['e1', 'e2']);
    expect(knowledge.timeline.map((item) => item.id)).toEqual(['s1', 's2']);
    expect(evidenceForClaim({ id: 'c1', mediaId: 'alpha', subject: 'ripley', predicate: 'appears-in', object: 'alpha', evidenceIds: ['e2'], confidence: 'medium' }, knowledge.evidence).map((item) => item.id)).toEqual(['e2']);
  });

  it('connects recommendation explanations to indexed evidence', async () => {
    const knowledge = buildMediaKnowledge({ media: title('alpha'), evidence: [{ id: 'e1', kind: 'catalog', sourceId: 'catalog', observedAt: '2026-09-12T00:00:00Z', confidence: 'high' }] }, '2026-09-12T01:00:00Z');
    const advisor = createDeterministicMediaAdvisor();
    await expect(advisor.recommend({ query: 'science', knowledge: [knowledge] }, [title('alpha')])).resolves.toEqual([{ titleId: 'alpha', score: 16, reasons: ['Matches your search for science', 'Supported by indexed media evidence'], evidenceIds: ['e1'] }]);
    expect(createMediaIntelligenceSnapshot([knowledge], [title('alpha')], { query: 'science' }).recommendations[0]?.evidenceIds).toEqual(['e1']);
  });

  it('builds transfer commands without granting authority', () => {
    const target = { id: 'tv1', name: 'Living room', transport: 'jhadinatv-tv' as const };
    expect(buildTransferCommand(target)).toEqual({ type: 'transfer', target });
  });

  it('requires an active controller before remote commands', async () => {
    const controller: MediaSessionController = {
      transport: 'jhadinatv-tv', discoverTargets: async () => [], connect: vi.fn(), disconnect: vi.fn(), send: vi.fn(), getState: async () => null,
    };
    const manager = createCastingManager([controller], { titleId: 'alpha', kind: 'movie', sourceUrl: 'https://media.example/a', positionSeconds: 0, playing: false });
    await expect(manager.send({ type: 'play' })).rejects.toThrow(/No TV playback session/);
  });

  it('clamps unified-session seek and volume commands', async () => {
    let localState = { titleId: 'alpha', kind: 'movie' as const, sourceUrl: 'https://media.example/a', positionSeconds: 10, playing: false };
    const local = {
      getState: () => localState,
      apply: vi.fn(async (command: Exclude<MediaSessionCommand, { type: 'transfer' }>) => {
        if (command.type === 'seek') localState = { ...localState, positionSeconds: command.value ?? 0 };
      }),
      onStateChange: () => () => {},
    };
    const casting = createCastingManager([], localState);
    const session = createUnifiedMediaSession({ titleId: 'alpha', kind: 'movie', sourceUrl: localState.sourceUrl, local, casting });
    await session.seek(-5);
    await session.setVolume(4);
    expect(local.apply).toHaveBeenNthCalledWith(1, { type: 'seek', value: 0 });
    expect(local.apply).toHaveBeenNthCalledWith(2, { type: 'set-volume', value: 1 });
  });
});
