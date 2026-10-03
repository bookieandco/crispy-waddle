import {JHADINA_CANONICAL_VOICE_IDENTITY_ID} from './jhadina-voice-identity.js';

export type JhadinaVoiceSurface =
  | 'ask'
  | 'desktop'
  | 'phone'
  | 'device'
  | 'director'
  | 'social'
  | 'music'
  | 'tv'
  | 'embodied';

export interface CanonicalJhadinaSurfaceVoiceBinding {
  surface:JhadinaVoiceSurface;
  purpose:string;
  voiceProfileId:'jhadina:canonical';
  speakerIdentityRef:typeof JHADINA_CANONICAL_VOICE_IDENTITY_ID;
  speakerIdentityVersion:1;
  subject:'assistant:jhadina';
  expressionProfileRef?:string;
  authority:'VOICE_IDENTITY_REFERENCE_ONLY';
}

/**
 * One acoustic speaker identity, many expression surfaces.
 *
 * expressionProfileRef may change brand/register/style. It never changes who is
 * acoustically speaking. Approval/readiness remains owned by the canonical voice
 * identity runtime rather than this reference.
 */
export function canonicalJhadinaSurfaceVoice(input:{
  surface:JhadinaVoiceSurface;
  purpose:string;
  expressionProfileRef?:string;
}):CanonicalJhadinaSurfaceVoiceBinding{
  const purpose=input.purpose.trim();
  if(!purpose) throw new Error('JHADINA_SURFACE_VOICE_PURPOSE_REQUIRED');
  const expressionProfileRef=input.expressionProfileRef?.trim();
  return Object.freeze({
    surface:input.surface,
    purpose,
    voiceProfileId:'jhadina:canonical',
    speakerIdentityRef:JHADINA_CANONICAL_VOICE_IDENTITY_ID,
    speakerIdentityVersion:1 as const,
    subject:'assistant:jhadina' as const,
    ...(expressionProfileRef?{expressionProfileRef}:{}),
    authority:'VOICE_IDENTITY_REFERENCE_ONLY' as const,
  });
}

export function isCanonicalJhadinaSpeakerIdentity(value:string|undefined):boolean{
  return value?.trim()===JHADINA_CANONICAL_VOICE_IDENTITY_ID;
}
