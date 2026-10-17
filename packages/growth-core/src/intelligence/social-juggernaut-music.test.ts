import { describe, expect, it } from 'vitest';
import type {
  ArtistKernel,
  CreativeOutlier,
  JuggernautSnapshot,
  SongRecord,
} from '../music-juggernaut/domain.js';
import { compileSocialJuggernautPlan } from './social-juggernaut.js';
import { musicJuggernautSongToSocialSubject } from './social-juggernaut-music.js';

const song: SongRecord = {
  id: 'song:bookie:1',
  title: 'Song One',
  status: 'released',
  artistConviction: 88,
  rightsState: 'clear',
  evidenceRefs: ['music:song:1'],
  sections: [{
    id: 'section:hook',
    songId: 'song:bookie:1',
    startMs: 30000,
    endMs: 45000,
    label: 'hook',
    functions: ['lyric', 'melody', 'loop'],
  }],
};

const kernel: ArtistKernel = {
  artistId: 'atwood-bookie',
  story: ['Detroit artist'],
  personalityTraits: ['funny', 'direct'],
  tasteSignals: ['dark humor', 'cinematic'],
  sonicSignatures: ['rap', 'melodic hook'],
  visualSignatures: ['nighttime city'],
  antiSignatures: ['generic luxury'],
  superpowers: ['storytelling'],
  evidenceRefs: ['artist-kernel:1'],
};

function snapshot(): JuggernautSnapshot {
  return {
    artistId: 'atwood-bookie',
    mode: 'SEARCH',
    songs: [song],
    experiments: [{
      id: 'experiment:1',
      songId: song.id,
      sectionId: 'section:hook',
      hypothesis: 'Story cold-open transfers listeners.',
      contentFamily: 'story',
      platform: 'instagram',
      audience: 'cold music discovery',
      spendMinor: 0,
      currency: 'USD',
      sampleTarget: 1000,
      successSignal: 'song_actions',
      failureSignal: 'no_transfer',
      status: 'complete',
      evidenceRefs: ['experiment:1:evidence'],
    }],
    observations: [{
      id: 'observation:1',
      experimentId: 'experiment:1',
      exposures: 10000,
      views: 8000,
      shares: 500,
      saves: 400,
      comments: 200,
      profileVisits: 900,
      songActions: 1200,
      directFanCaptures: 150,
      purchases: 10,
      botRisk: 0.02,
      attributionConfidence: 0.9,
      observedAt: '2026-10-07T18:00:00.000Z',
      evidenceRefs: ['observation:1:evidence'],
    }],
    fans: [],
    cityDemand: [],
    budget: {
      approvedMinor: 0,
      spentMinor: 0,
      experimentReserveMinor: 0,
      breakoutReserveMinor: 0,
      productionReserveMinor: 0,
      currency: 'USD',
    },
  };
}

describe('Music Juggernaut -> Social Juggernaut bridge', () => {
  it('creates a SEARCH social subject from the canonical song and artist kernel', () => {
    const subject = musicJuggernautSongToSocialSubject({
      snapshot: snapshot(),
      song,
      artistKernel: kernel,
      brandId: 'brand:atwood-bookie',
      preferredSurfaces: ['social:instagram', 'social:tiktok', 'social:youtube', 'social:x'],
      evidenceQuality: 90,
      contentReadiness: 85,
      urgency: 70,
    });

    expect(subject.kind).toBe('music');
    expect(subject.audienceSignals).toContain('dark humor');
    expect(subject.objectives).toContain('music_transfer');
    expect(compileSocialJuggernautPlan(subject).mode).toBe('SEARCH');
  });

  it('moves Social to ATTACK only from a replicated validated Music outlier', () => {
    const outliers: CreativeOutlier[] = [{
      experimentId: 'experiment:1',
      relativeLift: 1.8,
      confidence: 0.92,
      replicationCount: 2,
      status: 'validated',
      reasons: ['Replicated transfer lift.'],
      evidenceRefs: ['outlier:1', 'outlier:replication:2'],
    }];

    const subject = musicJuggernautSongToSocialSubject({
      snapshot: snapshot(),
      song,
      artistKernel: kernel,
      brandId: 'brand:atwood-bookie',
      preferredSurfaces: ['social:instagram', 'social:tiktok'],
      evidenceQuality: 95,
      contentReadiness: 90,
      urgency: 90,
      outliers,
    });

    expect(subject.validatedWinningMechanic?.id).toBe('music-winner:experiment:1');
    expect(compileSocialJuggernautPlan(subject).mode).toBe('ATTACK');
  });

  it('fails closed when canonical song rights are blocked', () => {
    expect(() => musicJuggernautSongToSocialSubject({
      snapshot: { ...snapshot(), songs: [{ ...song, rightsState: 'blocked' }] },
      song: { ...song, rightsState: 'blocked' },
      artistKernel: kernel,
      brandId: 'brand:atwood-bookie',
      preferredSurfaces: ['social:instagram'],
      evidenceQuality: 90,
      contentReadiness: 80,
      urgency: 60,
    })).toThrow(/MUSIC_RIGHTS_BLOCKED/);
  });
});
