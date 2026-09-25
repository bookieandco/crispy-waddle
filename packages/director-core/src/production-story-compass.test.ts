import {describe,expect,it} from 'vitest';
import {validateNonfictionStoryCompass,type NonfictionStoryCompass} from './production-story-compass';

const compass:NonfictionStoryCompass={
  id:'story:mountain-hospital',
  projectId:'p',
  problem:'Remote community lacks reliable electricity and medical access.',
  intention:'Bring power and functional medical care to the community.',
  obstacle:'Harsh terrain, limited time and funding.',
  solution:'Complete the powered hospital while centering local people and partners.',
  timeConstraint:'Finish before the planned community lighting ceremony.',
  logline:'A team crosses harsh terrain to power a remote hospital and make care possible.',
  titleConcept:'We Powered a Mountain Hospital',
  thumbnailConcept:'dark hospital contrasted with first lights turning on',
  openingHook:'Ten days ago this hospital on a remote mountain had no reliable power.',
  act1Impact:'Establish the problem and why it matters.',
  act2Influence:'Build connection through people, setbacks, culture and progress.',
  act3Transformation:'Deliver the outcome and show what changes for the community.',
  identifiableCharacters:['local clinicians','community members','project team'],
  significantMomentOrEvent:'The hospital lights turn on for the first time.',
  authenticEmotion:'relief, gratitude and earned celebration',
  specificDetails:['remote terrain','medical limitations','community ceremony'],
  referenceAssetIds:['ref:medical-access','ref:location','ref:lighting-ceremony'],
  feasibility:{
    affordable:true,
    estimatedDurationDays:4,
    legalOrSafetyBlocked:false,
    advancesAtOthersExpense:false,
    notes:['three shoot days plus one contingency day'],
    evidenceIds:['budget:v1','schedule:v1','local-research:v1'],
  },
  evidenceIds:['whiteboard:v1','reference-bank:v1'],
  authority:'DIRECTOR_STORY_COMPASS',
};

describe('production story compass',()=>{
  it('keeps a compact narrative compass plus feasibility boundary',()=>{
    expect(validateNonfictionStoryCompass(compass)).toEqual(expect.objectContaining({
      admissible:true,reasons:[],
    }));
  });

  it('fails closed when the production is legally/safety blocked or exploits others',()=>{
    const result=validateNonfictionStoryCompass({
      ...compass,
      feasibility:{
        ...compass.feasibility,
        legalOrSafetyBlocked:true,
        advancesAtOthersExpense:true,
      },
    });
    expect(result.reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_STORY_COMPASS_LEGAL_OR_SAFETY_BLOCK',
      'DIRECTOR_STORY_COMPASS_HARM_BOUNDARY_BLOCK',
    ]));
  });
});
