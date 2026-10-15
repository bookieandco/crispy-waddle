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
  it('changes the next brief only for admitted same-song evidence and versions the resulting brief',()=>{
    const baseline=buildMusicCreativePortfolio({song,mode:'SEARCH',maxBriefs:3});
    const learned=buildMusicCreativePortfolio({song,mode:'SEARCH',maxBriefs:3,admittedLearnings:[{
      songId:'s1',experimentId:'exp:story1',family:'story',confidence:0.92,evidenceRefs:['observation:17'],
    }]});
    expect(baseline.briefs[0]?.family).toBe('mini_music_video');
    expect(learned.briefs[0]?.family).toBe('story');
    expect(learned.briefs[0]?.hook).toContain('Retest the validated story opening');
    expect(learned.briefs[0]?.id).toContain(':learning:exp:story1');
    expect(learned.briefs[0]?.evidenceRefs).toContain('observation:17');
    const unqualified=buildMusicCreativePortfolio({song,mode:'SEARCH',maxBriefs:3,admittedLearnings:[{
      songId:'other-song',experimentId:'wrong',family:'story',confidence:1,evidenceRefs:['observation:19'],
    },{songId:'s1',experimentId:'weak',family:'story',confidence:0.4,evidenceRefs:['observation:20']}]});
    expect(unqualified.briefs[0]?.family).toBe(baseline.briefs[0]?.family);
  });
  it('requires a known winning section in attack mode',()=>{expect(()=>buildMusicCreativePortfolio({song,mode:'ATTACK'})).toThrow('MUSIC_JUGGERNAUT_ATTACK_SECTION_REQUIRED');});
});
