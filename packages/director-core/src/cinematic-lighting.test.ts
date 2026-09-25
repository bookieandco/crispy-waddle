import {describe,expect,it} from 'vitest';
import {compileTakePrompt} from './generation-orchestrator';
import {
  CINEMATIC_LIGHTING_ORDER,
  compileCinematographyLightingDirective,
  stopsToBrightnessRatio,
  validateCinematographyLightingPlan,
  type CinematographyLightingPlan,
} from './cinematic-lighting';

const plan:CinematographyLightingPlan={
  version:1,
  goal:'Keep both characters emotionally cohesive while preserving dimensional faces and foreground/background separation.',
  attributeOrder:CINEMATIC_LIGHTING_ORDER,
  directionSetups:[
    {
      id:'key:window',
      role:'key',
      direction:'rembrandt',
      subjectIds:['hubert','said','vinz'],
      horizontalAngleDegrees:45,
      downwardAngleDegrees:45,
      highPlacement:true,
      narrativeEffect:'Naturalistic dimensional key with controlled contrast.',
      evidenceIds:['lighting-study:key'],
    },
  ],
  subjectInterpretations:[
    {subjectId:'vinz',sourceSetupId:'key:window',perceivedDirection:'backlight',blockingRef:'blocking:vinz-mark',evidenceIds:['blocking:vinz']},
    {subjectId:'hubert',sourceSetupId:'key:window',perceivedDirection:'rembrandt',blockingRef:'blocking:hubert-mark',evidenceIds:['blocking:hubert']},
    {subjectId:'said',sourceSetupId:'key:window',perceivedDirection:'butterfly',blockingRef:'blocking:said-mark',evidenceIds:['blocking:said']},
  ],
  quality:{
    quality:'soft',
    relativeSourceSize:2.5,
    subjectDistanceMeters:1.5,
    diffusion:'4x4 diffusion frame',
    fillDiffusionFrameEvenly:true,
    rationale:'Large relative source keeps shadow edges soft while retaining shaped direction.',
    evidenceIds:['lighting-study:quality'],
  },
  color:{
    keyColorTemperatureKelvin:5600,
    cameraWhiteBalanceKelvin:4800,
    practicalColorTemperatureKelvin:2000,
    gelOrRgbNotes:['optional plus-green only when motivated by practical/environment'],
    creativeIntent:'Let the daylight key read slightly cooler while practicals retain warm contrast.',
    evidenceIds:['lighting-study:color'],
  },
  intensity:{
    unit:'relative',
    keyLevel:1,
    fillLevel:.25,
    backgroundLevel:.4,
    keyToFillStops:2,
    foregroundToBackgroundStops:1.25,
    exposureIntent:'Set the key side first, then shape fill and keep the subject modestly brighter than the background.',
    evidenceIds:['lighting-study:intensity'],
  },
  cutAndShape:[
    {id:'neg-fill',kind:'negative-fill',target:'shadow side',placement:'subject-shadow-side',purpose:'Reduce ambient bounce on the fill side.',evidenceIds:['lighting-study:negative-fill']},
    {id:'sider',kind:'sider',target:'background spill',placement:'between-diffusion-and-subject',purpose:'Keep the soft key off the background.',evidenceIds:['lighting-study:sider']},
  ],
  blockingNotes:['Keep talent far enough from bright walls to control subject/background ratio independently.'],
  preserveAcrossCoverage:['emotional light direction','key softness','color relationship','subject/background separation'],
  evidenceIds:['course:cinematic-lighting'],
  authority:'DIRECTOR_CINEMATOGRAPHY_LIGHTING',
};

describe('cinematic lighting',()=>{
  it('preserves the five-attribute working order and compiles blocking-aware direction',()=>{
    expect(validateCinematographyLightingPlan(plan).filter(issue=>issue.severity==='error')).toEqual([]);
    const directive=compileCinematographyLightingDirective(plan);
    expect(directive.indexOf('Direction:')).toBeLessThan(directive.indexOf('Quality:'));
    expect(directive.indexOf('Quality:')).toBeLessThan(directive.indexOf('Color:'));
    expect(directive.indexOf('Color:')).toBeLessThan(directive.indexOf('Intensity/exposure:'));
    expect(directive.indexOf('Intensity/exposure:')).toBeLessThan(directive.indexOf('Cut & Shape:'));
    expect(directive).toContain('vinz reads as backlight');
    expect(directive).toContain('hubert reads as rembrandt');
    expect(directive).toContain('said reads as butterfly');
  });

  it('survives into the canonical take prompt as structured lighting direction',()=>{
    const prompt=compileTakePrompt({
      takeId:'take:lighting',
      projectId:'p',
      sceneId:'scene:1',
      storyboardBoardId:'board:1',
      prompt:'Two characters talk in a dim room.',
      locked:['lighting','color'],
      lightingPlan:plan,
    });
    expect(prompt).toContain('[CINEMATOGRAPHY LIGHTING]');
    expect(prompt).toContain('Work order: Direction -> Quality/softness -> Color -> Intensity/exposure -> Cut & Shape.');
    expect(prompt).toContain('key-to-fill 2 stops (4:1)');
    expect(prompt).toContain('foreground-to-background 1.25 stops');
  });

  it('expresses stop differences as brightness ratios',()=>{
    expect(stopsToBrightnessRatio(1)).toBe(2);
    expect(stopsToBrightnessRatio(2)).toBe(4);
    expect(stopsToBrightnessRatio(3)).toBe(8);
    expect(stopsToBrightnessRatio(4)).toBe(16);
  });

  it('rejects changing the source ordering because later changes can disturb exposure',()=>{
    const wrong:CinematographyLightingPlan={...plan,attributeOrder:['intensity','direction','quality','color','cut-shape']};
    expect(validateCinematographyLightingPlan(wrong).map(issue=>issue.code))
      .toContain('LIGHTING_ATTRIBUTE_ORDER_INVALID');
  });

  it('warns when a flag is placed before diffusion rather than between diffusion and subject',()=>{
    const warned:CinematographyLightingPlan={
      ...plan,
      cutAndShape:[{
        id:'flag',
        kind:'flag',
        target:'background',
        placement:'between-source-and-diffusion',
        purpose:'Cut spill.',
        evidenceIds:['lighting-study:flag'],
      }],
    };
    expect(validateCinematographyLightingPlan(warned).map(issue=>issue.code))
      .toContain('LIGHTING_FLAG_PLACEMENT_SUBOPTIMAL');
  });
});
