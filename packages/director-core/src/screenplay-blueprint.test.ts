import {describe,expect,it} from 'vitest';
import {validateScreenplayBlueprint} from './screenplay-blueprint';

describe('screenplay blueprint',()=>{
  const treatment={
    id:'treatment:1',
    projectId:'p',
    title:'Night at the Bar',
    synopsis:'Two people meet outside a neighborhood bar and make a difficult choice.',
    beginning:'Establish the meeting and tension.',
    middle:'The conversation complicates the decision.',
    ending:'One person chooses whether to walk away.',
    characterRefs:['character:a','character:b'],
    locationRefs:['location:bar'],
    evidenceIds:['idea:notebook'],
    authority:'DIRECTOR_STORY_TREATMENT' as const,
  };

  const scene={
    id:'scene:1',
    projectId:'p',
    order:1,
    interiorExterior:'EXT' as const,
    location:'neighborhood bar',
    timeOfDay:'night',
    action:['Two figures stand beneath a streetlight outside the bar.'],
    dialogue:[
      {id:'line:1',characterId:'character:a',text:'I need you to stay here.',evidenceIds:['script:draft-1']},
    ],
    treatmentId:treatment.id,
    evidenceIds:['script:draft-1'],
    authority:'DIRECTOR_SCREENPLAY_SCENE' as const,
  };

  it('keeps the screenplay readable while camera and production detail live in director annotations',()=>{
    expect(validateScreenplayBlueprint({
      treatment,
      scenes:[scene],
      shootingAnnotations:[
        {
          id:'director:scene-1',
          projectId:'p',
          sceneId:'scene:1',
          shotIds:['coverage:wide','coverage:close-a'],
          cameraDirection:'Preserve the established dialogue axis.',
          lightingDirection:'Keep the practical streetlight as the motivated source.',
          productionNotes:['Capture clean ambience for the location.'],
          evidenceIds:['director:plan-1'],
          authority:'DIRECTOR_SHOOTING_SCRIPT_ANNOTATION',
        },
      ],
    }).valid).toBe(true);
  });

  it('fails director annotations that are not tied to a screenplay scene',()=>{
    const decision=validateScreenplayBlueprint({
      treatment,
      scenes:[scene],
      shootingAnnotations:[
        {
          id:'director:bad',
          projectId:'p',
          sceneId:'scene:missing',
          shotIds:['coverage:1'],
          productionNotes:[],
          evidenceIds:['director:bad'],
          authority:'DIRECTOR_SHOOTING_SCRIPT_ANNOTATION',
        },
      ],
    });
    expect(decision.reasons).toContain('DIRECTOR_SHOOTING_SCRIPT_ANNOTATION_INVALID:director:bad');
  });
});
