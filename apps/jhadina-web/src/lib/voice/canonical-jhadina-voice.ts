import {
  canonicalJhadinaSurfaceVoice,
  isCanonicalJhadinaSpeakerIdentity,
  type CanonicalJhadinaSurfaceVoiceBinding,
} from '@jhadina/core-spine';

export interface SocialSpeakerCarrier {
  id:string;
  voiceProfileRef:string;
  speakerIdentityRef?:string;
}

export function resolveJhadinaDirectorNarration(
  character:SocialSpeakerCarrier|undefined,
):CanonicalJhadinaSurfaceVoiceBinding|undefined{
  const speaker=character?.speakerIdentityRef?.trim();
  if(!speaker) return undefined;
  if(!isCanonicalJhadinaSpeakerIdentity(speaker)){
    throw new Error('JHADINA_SURFACE_SPEAKER_IDENTITY_NOT_ADMITTED');
  }
  return canonicalJhadinaSurfaceVoice({
    surface:'director',
    purpose:'social-video-narration',
    expressionProfileRef:character.voiceProfileRef,
  });
}

export function canonicalJhadinaBindingForSurface(input:{
  surface:'ask'|'desktop'|'phone'|'device'|'director'|'social'|'music'|'tv'|'embodied';
  purpose:string;
  expressionProfileRef?:string;
}):CanonicalJhadinaSurfaceVoiceBinding{
  return canonicalJhadinaSurfaceVoice(input);
}
