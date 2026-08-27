import { describe, expect, it } from 'vitest';
import { buildUnifiedGuide, getCurrentProgram } from '@jhadina/tv-core';
import type { LiveChannel, LiveProgram } from '@jhadina/tv-core';

const channel: LiveChannel = { id: 'channel-1', name: 'Test Channel', kind: 'broadcast', source: 'test', provenance: 'user-configured' };

const programs: LiveProgram[] = [
  { id: 'program-1', channelId: channel.id, title: 'Now', startTime: '2026-08-25T18:00:00.000Z', endTime: '2026-08-25T19:00:00.000Z' },
  { id: 'program-2', channelId: channel.id, title: 'Later', startTime: '2026-08-25T19:00:00.000Z', endTime: '2026-08-25T20:00:00.000Z' },
];

describe('unified live guide', () => {
  it('selects the program currently airing', () => {
    expect(getCurrentProgram(programs, new Date('2026-08-25T18:30:00.000Z'))?.title).toBe('Now');
    expect(getCurrentProgram(programs, new Date('2026-08-25T19:00:00.000Z'))?.title).toBe('Later');
  });

  it('builds one guide row per channel', () => {
    const rows = buildUnifiedGuide([channel], programs, new Date('2026-08-25T18:30:00.000Z'));
    expect(rows).toHaveLength(1);
    expect(rows[0].channel.id).toBe(channel.id);
    expect(rows[0].program?.id).toBe('program-1');
  });
});
