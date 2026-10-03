import {describe,it,expect} from 'vitest';
import {
  canonicalJhadinaSurfaceVoice,
  isCanonicalJhadinaSpeakerIdentity,
} from './voice-surface-binding.js';

describe('canonical Jhadina surface voice binding',()=>{
  it('keeps one acoustic identity across differently styled surfaces',()=>{
    const ask=canonicalJhadinaSurfaceVoice({
      surface:'ask',purpose:'live answer',expressionProfileRef:'brand-voice:jhadina',
    });
    const tv=canonicalJhadinaSurfaceVoice({
      surface:'tv',purpose:'entertainment narration',expressionProfileRef:'brand-voice:jhadinatv',
    });
    const music=canonicalJhadinaSurfaceVoice({
      surface:'music',purpose:'music commentary',expressionProfileRef:'brand-voice:jhadina-music',
    });
    expect(new Set([ask.speakerIdentityRef,tv.speakerIdentityRef,music.speakerIdentityRef]).size).toBe(1);
    expect(ask.speakerIdentityRef).toBe('voice:jhadina:canonical:v1');
    expect(tv.expressionProfileRef).toBe('brand-voice:jhadinatv');
    expect(music.expressionProfileRef).toBe('brand-voice:jhadina-music');
    expect(ask.voiceProfileId).toBe('jhadina:canonical');
  });

  it('does not treat expression profile names as speaker identity',()=>{
    expect(isCanonicalJhadinaSpeakerIdentity('brand-voice:jhadina')).toBe(false);
    expect(isCanonicalJhadinaSpeakerIdentity('voice:jhadina:canonical:v1')).toBe(true);
  });

  it('requires an explicit surface purpose without granting approval authority',()=>{
    expect(()=>canonicalJhadinaSurfaceVoice({surface:'director',purpose:' '}))
      .toThrow('JHADINA_SURFACE_VOICE_PURPOSE_REQUIRED');
    expect(canonicalJhadinaSurfaceVoice({surface:'phone',purpose:'assistant reply'}).authority)
      .toBe('VOICE_IDENTITY_REFERENCE_ONLY');
  });
});
