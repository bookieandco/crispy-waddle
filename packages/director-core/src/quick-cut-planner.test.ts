import { describe, expect, it } from 'vitest';
import { classifyQuickCutRole, planQuickCut } from './quick-cut-planner';

const media = [
  {
    assetId:'talk:controller',
    durationSeconds:780,
    hasDecipherableSpeech:true,
    scopes:['current-project','current-timeline'] as const,
    transcriptSpans:[
      {
        id:'build',
        startSeconds:10,
        endSeconds:25,
        text:'The build quality is excellent and the rubber grips feel sturdy.',
        themeTags:['build quality','rubber grips'],
        importance:.95,
        evidenceIds:['transcript:build'],
      },
      {
        id:'customization',
        startSeconds:40,
        endSeconds:58,
        text:'You can customize the sticks and swap the D-pad.',
        themeTags:['customization','sticks','d-pad'],
        importance:.9,
        evidenceIds:['transcript:customization'],
      },
      {
        id:'price',
        startSeconds:120,
        endSeconds:132,
        text:'The price is the biggest downside.',
        themeTags:['price','cons'],
        importance:.88,
        evidenceIds:['transcript:price'],
      },
      {
        id:'bumpers',
        startSeconds:145,
        endSeconds:160,
        text:'The bumper buttons are prone to break.',
        themeTags:['bumper buttons','cons'],
        importance:.9,
        evidenceIds:['transcript:bumpers'],
      },
      {
        id:'recommend',
        startSeconds:200,
        endSeconds:214,
        text:'Overall I recommend it for frequent gamers.',
        themeTags:['recommendation','frequent gamers'],
        importance:.92,
        evidenceIds:['transcript:recommend'],
      },
    ],
    visualTags:['speaker','controller'],
    evidenceIds:['asset:talk'],
  },
  {
    assetId:'broll:sticks',
    durationSeconds:8,
    hasDecipherableSpeech:false,
    scopes:['current-project'] as const,
    visualTags:['customization','sticks','controller'],
    evidenceIds:['vision:sticks'],
  },
  {
    assetId:'broll:dpad',
    durationSeconds:7,
    hasDecipherableSpeech:false,
    scopes:['current-project'] as const,
    visualTags:['customization','d-pad','controller'],
    evidenceIds:['vision:dpad'],
  },
  {
    assetId:'broll:rehearsal',
    durationSeconds:12,
    hasDecipherableSpeech:false,
    scopes:['current-selection'] as const,
    visualTags:['rehearsal','behind the scenes'],
    evidenceIds:['vision:rehearsal'],
  },
];

describe('Quick Cut planner', () => {
  it('builds a proposal-only dialogue rough cut with a separate contextual B-roll track', () => {
    const result=planQuickCut({
      id:'quickcut:controller:1',
      projectId:'project',
      fps:30,
      width:1920,
      height:1080,
      videoType:'dialogue-driven',
      mediaScope:'current-project',
      prompt:'controller review with build quality, customization, price, bumper buttons, recommendation',
      focusThemes:['build quality','customization','price','bumper buttons','recommendation'],
      targetDurationSeconds:60,
      createBrollTrack:true,
      minimumThemeSupport:.8,
      sourceMedia:media,
      iteration:1,
    });

    expect(result.authority).toBe('PROPOSAL_ONLY');
    expect(result.timeline.tracks.map(track=>track.id)).toEqual(['quickcut-a-roll','quickcut-b-roll']);
    expect(result.timeline.tracks[1]?.muted).toBeUndefined();
    expect(result.timeline.tracks[1]?.clips.every(clip=>clip.muted===true)).toBe(true);
    expect(result.timeline.tracks[0]?.clips.some(clip=>clip.assetId==='talk:controller')).toBe(true);
    expect(result.timeline.tracks[1]?.clips.map(clip=>clip.assetId)).toEqual(expect.arrayContaining([
      'broll:sticks',
      'broll:dpad',
    ]));
    expect(result.estimatedDurationSeconds).toBeLessThanOrEqual(60);
    expect(result.unsupportedThemes).toEqual([]);
  });

  it('does not invent a theme that the transcript does not support', () => {
    const result=planQuickCut({
      id:'quickcut:unsupported',
      projectId:'project',
      fps:30,
      width:1080,
      height:1920,
      videoType:'dialogue-driven',
      mediaScope:'current-project',
      focusThemes:['battery life','water resistance'],
      targetDurationSeconds:30,
      createBrollTrack:false,
      minimumThemeSupport:0,
      sourceMedia:media,
    });

    expect(result.unsupportedThemes).toEqual(['battery life','water resistance']);
    expect(result.limitations).toContain('unsupported-themes:battery life|water resistance');
    expect(result.timeline.markers).toHaveLength(2);
  });

  it('can fail closed when requested theme support is below policy', () => {
    expect(()=>planQuickCut({
      id:'quickcut:unsupported-strict',
      projectId:'project',
      fps:30,
      width:1920,
      height:1080,
      videoType:'dialogue-driven',
      mediaScope:'current-project',
      focusThemes:['build quality','battery life'],
      targetDurationSeconds:30,
      createBrollTrack:false,
      minimumThemeSupport:1,
      sourceMedia:media,
    })).toThrow('DIRECTOR_QUICK_CUT_THEME_SUPPORT_INSUFFICIENT');
  });

  it('classifies speech as A-roll and silent footage as B-roll unless manually overridden', () => {
    expect(classifyQuickCutRole(media[0]!)).toBe('a-roll');
    expect(classifyQuickCutRole(media[1]!)).toBe('b-roll');
    expect(classifyQuickCutRole({
      ...media[1]!,
      manualRole:'a-roll',
    })).toBe('a-roll');
  });

  it('respects current-selection scope instead of silently pulling from the whole project', () => {
    const result=planQuickCut({
      id:'quickcut:selection',
      projectId:'project',
      fps:30,
      width:1080,
      height:1920,
      videoType:'visual-only',
      mediaScope:'current-selection',
      focusThemes:['rehearsal','behind the scenes'],
      targetDurationSeconds:10,
      createBrollTrack:false,
      sourceMedia:media,
    });

    expect(result.selections.map(item=>item.assetId)).toEqual(['broll:rehearsal']);
    expect(result.timeline.width).toBe(1080);
    expect(result.timeline.height).toBe(1920);
  });

  it('keeps multiple iterations as independent proposal identities', () => {
    const first=planQuickCut({
      id:'quickcut:interview:v1',
      projectId:'p',
      fps:24,
      width:1920,
      height:1080,
      videoType:'dialogue-driven',
      mediaScope:'current-timeline',
      focusThemes:['build quality'],
      targetDurationSeconds:15,
      createBrollTrack:false,
      sourceMedia:media,
      iteration:1,
    });
    const second=planQuickCut({
      id:'quickcut:interview:v2',
      projectId:'p',
      fps:24,
      width:1920,
      height:1080,
      videoType:'dialogue-driven',
      mediaScope:'current-timeline',
      focusThemes:['price'],
      targetDurationSeconds:15,
      createBrollTrack:false,
      sourceMedia:media,
      iteration:2,
    });

    expect(first.id).not.toBe(second.id);
    expect(first.iteration).toBe(1);
    expect(second.iteration).toBe(2);
    expect(first.authority).toBe('PROPOSAL_ONLY');
    expect(second.authority).toBe('PROPOSAL_ONLY');
  });
});
