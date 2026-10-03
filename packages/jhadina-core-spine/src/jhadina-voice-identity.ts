import type { CanonicalVoiceIdentity } from './voice-identity-shared.js';

export const JHADINA_CANONICAL_VOICE_IDENTITY_ID='voice:jhadina:canonical:v1';

/**
 * Stable identity target. It is intentionally a candidate until a real generated
 * reference sample is selected, fingerprinted, and explicitly approved.
 */
export const JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE:CanonicalVoiceIdentity=Object.freeze({
  id:JHADINA_CANONICAL_VOICE_IDENTITY_ID,
  version:1,
  subject:Object.freeze({type:'assistant' as const,id:'jhadina'}),
  displayName:'Jhadina',
  source:'designed',
  primaryLanguage:'en-US',
  status:'candidate',
  referenceSamples:Object.freeze([]),
  providerBindings:Object.freeze([]),
  languageVariants:Object.freeze([]),
  speakerFingerprintRefs:Object.freeze([]),
  minimumSpeakerSimilarity:0.80,
});
