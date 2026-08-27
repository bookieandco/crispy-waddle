import { describe, expect, it } from 'vitest';
import { createJhadinaChannelEngine } from '@jhadina/tv-core';
import type { MediaTitle } from '@jhadina/tv-core';

const catalog: MediaTitle[] = [
  { id: 'crime-1', kind: 'movie', title: 'Crime One', overview: '', year: 2020, runtimeMinutes: 100, genres: ['Crime'], availability: 'owned' },
  { id: 'comedy-1', kind: 'movie', title: 'Comedy One', overview: '', year: 2020, runtimeMinutes: 90, genres: ['Comedy'], availability: 'owned' },
];

describe('Jhadina channel engine', () => {
  it('generates deterministic genre schedules', () => {
    const engine = createJhadinaChannelEngine();
    const schedule = engine.generateSchedule(
      { id: 'crime', name: 'Crime Classics', genres: ['crime'], durationMinutes: 60 },
      catalog,
      '2026-08-25T18:00:00.000Z',
      '2026-08-25T20:00:00.000Z',
    );

    expect(schedule.items).toHaveLength(2);
    expect(schedule.items.every((item) => item.titleId === 'crime-1')).toBe(true);
    expect(schedule.items[0].startTime).toBe('2026-08-25T18:00:00.000Z');
    expect(schedule.items[1].startTime).toBe('2026-08-25T19:00:00.000Z');
  });
});
