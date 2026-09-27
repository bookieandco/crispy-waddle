import { describe, expect, it } from 'vitest';
import { buildUnifiedGuide, createJhadinaChannelEngine, getCurrentProgram, mapXmltvProgram, parseM3u, parseXmltvPrograms, type LiveChannel, type LiveProgram, type MediaTitle } from './index';

const channel: LiveChannel = {
  id: 'jellyfin:7',
  providerId: 'jellyfin',
  providerChannelId: '7',
  mediaId: '7',
  name: 'News 7',
  kind: 'broadcast',
  provenance: 'jellyfin',
};

const programs: LiveProgram[] = [
  { id: 'p1', channelId: channel.id, title: 'Morning News', startTime: '2026-09-26T16:00:00.000Z', endTime: '2026-09-26T17:00:00.000Z' },
  { id: 'p2', channelId: channel.id, title: 'Noon News', startTime: '2026-09-26T17:00:00.000Z', endTime: '2026-09-26T18:00:00.000Z' },
];

describe('JhadinaTV Live TV', () => {
  it('selects the current program using a closed-open time boundary', () => {
    expect(getCurrentProgram(programs, new Date('2026-09-26T16:30:00.000Z'))?.id).toBe('p1');
    expect(getCurrentProgram(programs, new Date('2026-09-26T17:00:00.000Z'))?.id).toBe('p2');
  });

  it('builds a guide without exposing playback URLs', () => {
    const row = buildUnifiedGuide([channel], programs, new Date('2026-09-26T16:30:00.000Z'))[0];
    expect(row.program?.title).toBe('Morning News');
    expect('source' in row.channel).toBe(false);
  });

  it('creates deterministic virtual channel schedules from the authorized catalog view', () => {
    const catalog: MediaTitle[] = [
      { id: 'a', kind: 'movie', title: 'A', overview: '', year: 2026, genres: ['Comedy'], availability: 'licensed' },
      { id: 'b', kind: 'movie', title: 'B', overview: '', year: 2026, genres: ['Comedy'], availability: 'licensed' },
    ];
    const schedule = createJhadinaChannelEngine().generateSchedule(
      { id: 'comedy', name: 'Comedy', genres: ['Comedy'], durationMinutes: 30 },
      catalog,
      '2026-09-26T16:00:00.000Z',
      '2026-09-26T17:00:00.000Z',
    );
    expect(schedule.items.map((item) => item.titleId)).toEqual(['a', 'b']);
  });
  it('parses M3U and XMLTV without promoting imported URLs into admitted channel metadata', () => {
    const m3u = parseM3u('#EXTM3U\n#EXTINF:-1 tvg-id="news7" group-title="News",News 7\nhttps://example.test/news.m3u8');
    expect(m3u[0]).toMatchObject({ name: 'News 7', tvgId: 'news7', group: 'News' });

    const xml = parseXmltvPrograms('<tv><programme channel="news7" start="20260926160000 +0000" stop="20260926170000 +0000"><title>News</title><desc>Headlines</desc></programme></tv>');
    expect(mapXmltvProgram(xml[0], channel.id)).toMatchObject({ channelId: channel.id, title: 'News' });
  });
});
