import {describe,expect,it} from 'vitest';
import {buildDialogueSegmentContinuityPacket,validateLongformDialogueState,type LongformDialogueState} from './longform-dialogue-state';

const state:LongformDialogueState={
  id:'dialogue:1',projectId:'p',sceneId:'scene:1',
  cast:[
    {characterId:'a',voiceIdentityId:'voice:a',positionLabel:'left'},
    {characterId:'b',voiceIdentityId:'voice:b',positionLabel:'right'},
    {characterId:'c',voiceIdentityId:'voice:c',positionLabel:'center'},
  ],
  turns:[
    {id:'t1',segmentIndex:0,order:0,kind:'line',characterId:'a',voiceIdentityId:'voice:a',lineId:'l1',text:'First line.',listenerCharacterIds:['b','c'],gesture:'minor',evidenceIds:['script:l1']},
    {id:'t2',segmentIndex:0,order:1,kind:'line',characterId:'b',voiceIdentityId:'voice:b',lineId:'l2',text:'Response.',listenerCharacterIds:['a','c'],gesture:'none',evidenceIds:['script:l2']},
    {id:'t3',segmentIndex:1,order:0,kind:'continue',characterId:'c',voiceIdentityId:'voice:c',lineId:'l3',text:'Continuation.',listenerCharacterIds:['a','b'],gesture:'major',evidenceIds:['script:l3']},
  ],
  segments:[
    {id:'s0',index:0,visualAnchorAssetId:'ensemble:1',turnIds:['t1','t2'],evidenceIds:['segment:0']},
    {id:'s1',index:1,visualAnchorAssetId:'ensemble:1',turnIds:['t3'],previousSegmentId:'s0',evidenceIds:['segment:1']},
  ],
  evidenceIds:['scene:approved'],authority:'DIRECTOR_LONGFORM_DIALOGUE_STATE',
};

describe('long-form dialogue state',()=>{
  it('carries cast, voices and previous speaker through generation segments',()=>{
    expect(validateLongformDialogueState(state)).toEqual([]);
    const packet=buildDialogueSegmentContinuityPacket(state,1);
    expect(packet.previousLastSpeakerCharacterId).toBe('b');
    expect(packet.turns.map(turn=>turn.characterId)).toEqual(['c']);
  });
  it('blocks voice identity crossover between characters',()=>{
    const broken={...state,turns:state.turns.map(turn=>turn.id==='t2'?{...turn,voiceIdentityId:'voice:a'}:turn)};
    expect(validateLongformDialogueState(broken)).toContain('DIRECTOR_DIALOGUE_TURN_VOICE_CROSSOVER:t2');
  });
  it('requires an exact segment chain rather than unrelated short clips',()=>{
    const broken={...state,segments:[state.segments[0]!,{...state.segments[1]!,previousSegmentId:undefined}]};
    expect(validateLongformDialogueState(broken)).toContain('DIRECTOR_DIALOGUE_SEGMENT_CHAIN_INVALID:s1');
  });
});
