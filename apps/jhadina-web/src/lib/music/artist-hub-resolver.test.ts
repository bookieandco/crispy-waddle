import {describe,expect,it} from 'vitest';
import {extractHubLinksFromHtml,resolveAtwoodBookieHub} from './artist-hub-resolver';

describe('Atwood Bookie artist hub resolver',()=>{
  it('extracts and normalizes outbound links without unsafe schemes',()=>{
    const links=extractHubLinksFromHtml(
      '<a href="https://open.spotify.com/artist/abc">Spotify</a><a href="/bookieandco">Self</a><a href="javascript:alert(1)">bad</a>',
      'https://solo.to/bookieandco',
    );
    expect(links).toContain('https://open.spotify.com/artist/abc');
    expect(links.some((item)=>item.startsWith('javascript:'))).toBe(false);
  });

  it('fails closed when the hub cannot be fetched',async()=>{
    const result=await resolveAtwoodBookieHub({
      fetchImpl:async()=>{throw new Error('blocked');},
      now:()=>new Date('2026-09-30T20:30:00-07:00'),
    });
    expect(result.fetched).toBe(false);
    expect(result.resolvedLinks).toHaveLength(0);
    expect(result.warnings[0]).toContain('no links are fabricated');
  });
});
