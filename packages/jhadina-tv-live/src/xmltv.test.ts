import { describe, expect, it } from 'vitest';
import { mapXmltvProgramToLiveProgram, parseXmltvPrograms } from './xmltv';

describe('XMLTV EPG', () => {
  it('parses and normalizes a programme', () => {
    const xml = '<tv><programme channel="abc" start="20260824130000 -0500" stop="20260824140000 -0500"><title>Local News</title><desc>Tonight\'s local headlines.</desc></programme></tv>';
    const parsed = parseXmltvPrograms(xml);
    expect(parsed).toHaveLength(1);
    expect(mapXmltvProgramToLiveProgram(parsed[0])).toEqual(expect.objectContaining({
      channelId: 'abc',
      title: 'Local News',
      startTime: '2026-08-24T13:00:00-05:00',
      endTime: '2026-08-24T14:00:00-05:00',
    }));
  });
});
