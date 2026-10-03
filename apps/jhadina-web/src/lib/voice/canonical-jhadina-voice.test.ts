import {describe,it,expect} from 'vitest';
import {
  canonicalJhadinaBindingForSurface,
  resolveJhadinaDirectorNarration,
} from './canonical-jhadina-voice';

describe('canonical Jhadina web voice resolver',()=>{
  it('resolves a Jhadina Social character into the one canonical acoustic identity',()=>{
    const binding=resolveJhadinaDirectorNarration({
      id:'character:jhadinatv',
      voiceProfileRef:'brand-voice:jhadinatv',
      speakerIdentityRef:'voice:jhadina:canonical:v1',
    });
    expect(binding).toMatchObject({
      surface:'director',
      voiceProfileId:'jhadina:canonical',
      speakerIdentityRef:'voice:jhadina:canonical:v1',
      expressionProfileRef:'brand-voice:jhadinatv',
      authority:'VOICE_IDENTITY_REFERENCE_ONLY',
    });
  });

  it('leaves unrelated characters without an acoustic binding',()=>{
    expect(resolveJhadinaDirectorNarration({
      id:'character:pupsonstuff',
      voiceProfileRef:'brand-voice:pupsonstuff',
    })).toBeUndefined();
  });

  it('fails closed if a Social character tries to substitute another speaker under Jhadina resolver',()=>{
    expect(()=>resolveJhadinaDirectorNarration({
      id:'character:jhadina',
      voiceProfileRef:'brand-voice:jhadina',
      speakerIdentityRef:'voice:someone-else:v1',
    })).toThrow('JHADINA_SURFACE_SPEAKER_IDENTITY_NOT_ADMITTED');
  });

  it('gives phone, desktop, music and embodied surfaces the same acoustic identity',()=>{
    const refs=['phone','desktop','music','embodied'].map(surface=>
      canonicalJhadinaBindingForSurface({
        surface:surface as 'phone'|'desktop'|'music'|'embodied',
        purpose:'assistant-speech',
      }).speakerIdentityRef
    );
    expect(new Set(refs)).toEqual(new Set(['voice:jhadina:canonical:v1']));
  });
});
