import {describe,expect,it} from 'vitest';
import {validateCinematicStoryBible} from './cinematic-story-bible';

describe('cinematic story bible',()=>{
  it('locks story, timeline, locations, character voice and personality without duplicating cast appearance authority',()=>{
    expect(validateCinematicStoryBible({
      id:'story-bible:raven',
      projectId:'p',
      premise:'A successful musician reflects on what mattered before and after success.',
      thesis:'Connection and continued growth matter more than arrival.',
      plotSummary:'An interview opens into memory fragments, present-day tour footage, and a final reflection.',
      timeline:[
        {id:'beat:1',order:1,label:'interview opens',summary:'Raven begins cautiously.',evidenceIds:['script:1']},
        {id:'beat:2',order:2,label:'memory',summary:'Childhood and her mother reframe the success story.',evidenceIds:['script:2']},
        {id:'beat:3',order:3,label:'present',summary:'Tour life resolves into connection rather than status.',evidenceIds:['script:3']},
      ],
      locations:[
        {id:'loc:interview',locationRef:'location:studio-couch',label:'interview studio',storyFunction:'present-tense reflection',continuityNotes:['locked couch and haze'],evidenceIds:['world:studio']},
        {id:'loc:childhood',locationRef:'location:childhood-home',label:'childhood home',storyFunction:'memory fragment',continuityNotes:['warm holiday morning'],evidenceIds:['world:childhood']},
      ],
      characters:[
        {
          characterId:'raven',
          castRecordId:'cast:raven',
          voiceIdentityId:'voice:raven',
          voiceTonality:'conversational, reflective, occasionally emotional; never stagey',
          personalityTraits:['driven','warm','self-aware'],
          defaultEmotionalState:'open but slightly guarded',
          storyFunction:'central autobiographical voice',
          evidenceIds:['character:approved','voice:approved'],
        },
      ],
      lockedCreativeTruths:[
        'Raven never performs the interview directly to camera.',
        'The story resolves on connection rather than fame.',
      ],
      evidenceIds:['project:story-development'],
      authority:'DIRECTOR_STORY_BIBLE',
    })).toEqual([]);
  });

  it('rejects duplicate character identities or ambiguous timeline ordering',()=>{
    const reasons=validateCinematicStoryBible({
      id:'b',projectId:'p',premise:'p',thesis:'t',plotSummary:'plot',
      timeline:[
        {id:'x',order:1,label:'a',summary:'a',evidenceIds:['e']},
        {id:'y',order:1,label:'b',summary:'b',evidenceIds:['e']},
      ],
      locations:[{id:'l',locationRef:'loc',label:'l',storyFunction:'f',continuityNotes:[],evidenceIds:['e']}],
      characters:[
        {characterId:'c',castRecordId:'cast:c',voiceTonality:'tone',personalityTraits:['p'],storyFunction:'f',evidenceIds:['e']},
        {characterId:'c',castRecordId:'cast:c2',voiceTonality:'tone',personalityTraits:['p'],storyFunction:'f',evidenceIds:['e']},
      ],
      lockedCreativeTruths:['lock'],evidenceIds:['e'],authority:'DIRECTOR_STORY_BIBLE',
    });
    expect(reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_STORY_BIBLE_BEAT_ORDER_INVALID:y',
      'DIRECTOR_STORY_BIBLE_CHARACTER_ID_INVALID:c',
    ]));
  });
});
