import {describe,expect,it} from 'vitest';
import {buildMusicCreativePortfolio,defaultMusicContentSpine} from './content.js';

const song={
  id:'s1',title:'Test',status:'released' as const,artistConviction:0.8,rightsState:'clear' as const,evidenceRefs:['song:1'],
  sections:[
    {id:'a',songId:'s1',startMs:0,endMs:10000,label:'verse',functions:['lyric'] as const},
    {id:'b',songId:'s1',startMs:10000,endMs:20000,label:'hook',functions:['melody','loop'] as const},
  ],
};

describe('Music Juggernaut Content Factory',()=>{
  it('keeps three permanent content spines',()=>{expect(defaultMusicContentSpine().map((x)=>x.family)).toEqual(['mini_music_video','location_performance','performance_platform']);});
  it('searches across genuine content families',()=>{
    const p=buildMusicCreativePortfolio({song,mode:'SEARCH',maxBriefs:8});
    expect(p.briefs.length).toBe(8);
    expect(p.diversity.sufficientForExploration).toBe(true);
    expect(new Set(p.briefs.map((x)=>x.family)).size).toBeGreaterThan(5);
  });
  it('attacks a validated section without collapsing wrapper diversity',()=>{
    const p=buildMusicCreativePortfolio({song,mode:'ATTACK',winningSectionId:'b',maxBriefs:7});
    expect(new Set(p.briefs.map((x)=>x.sectionId))).toEqual(new Set(['b']));
    expect(new Set(p.briefs.map((x)=>x.family)).size).toBeGreaterThan(5);
  });
  it('requires a known winning section in attack mode',()=>{expect(()=>buildMusicCreativePortfolio({song,mode:'ATTACK'})).toThrow('MUSIC_JUGGERNAUT_ATTACK_SECTION_REQUIRED');});
});
