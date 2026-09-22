export interface VoiceProviderProfile {
  id: string;
  role: 'runtime' | 'orchestrator' | 'evaluation' | 'reference-only';
  capabilities: readonly (
    | 'tts'
    | 'voice-design'
    | 'voice-clone'
    | 'voice-conversion'
    | 'accent-conversion'
    | 'multilingual'
    | 'streaming'
    | 'speaker-similarity-qc'
    | 'dubbing-workflow'
    | 'multi-track-story'
  )[];
  languages: readonly string[] | 'provider-defined';
  license: string;
  commercialUse: 'allowed' | 'conditional' | 'unknown';
  notes: string;
}

export const DIRECTOR_VOICE_PROVIDER_PROFILES: readonly VoiceProviderProfile[] = Object.freeze([
  Object.freeze({
    id: 'voicebox',
    role: 'orchestrator',
    capabilities: Object.freeze(['tts','voice-design','voice-clone','multilingual','multi-track-story','dubbing-workflow']),
    languages: 'provider-defined',
    license: 'MIT',
    commercialUse: 'conditional',
    notes: 'Local-first profile/version/take orchestration. Individual bundled engines and model weights retain their own licenses.',
  }),
  Object.freeze({
    id: 'qwen3-tts',
    role: 'runtime',
    capabilities: Object.freeze(['tts','voice-design','voice-clone','multilingual','streaming']),
    languages: Object.freeze(['zh','en','ja','ko','de','fr','ru','pt','es','it']),
    license: 'Apache-2.0 repository; exact admitted model artifact remains provenance-pinned',
    commercialUse: 'conditional',
    notes: 'Strong fictional-character path: design voice once, build reusable clone prompt, reuse it across dialogue lines and languages.',
  }),
  Object.freeze({
    id: 'voxcpm2',
    role: 'runtime',
    capabilities: Object.freeze(['tts','voice-design','voice-clone','multilingual','streaming']),
    languages: Object.freeze([
      'ar','my','zh','da','nl','en','fi','fr','de','el','he','hi','id','it','ja','km','ko','lo','ms','no','pl','pt','ru','es','sw','sv','tl','th','tr','vi',
    ]),
    license: 'Apache-2.0',
    commercialUse: 'allowed',
    notes: '30-language controllable cloning/design with 48 kHz output; strong multilingual dialogue provider.',
  }),
  Object.freeze({
    id: 'amphion',
    role: 'evaluation',
    capabilities: Object.freeze(['tts','voice-clone','voice-conversion','accent-conversion','speaker-similarity-qc']),
    languages: 'provider-defined',
    license: 'MIT code; model/checkpoint/dataset licenses vary',
    commercialUse: 'conditional',
    notes: 'Use primarily for speaker-similarity QC and specialized voice/accent/singing conversion unless exact model licenses are admitted.',
  }),
  Object.freeze({
    id: 'voice-pro',
    role: 'reference-only',
    capabilities: Object.freeze(['tts','voice-clone','multilingual','dubbing-workflow']),
    languages: 'provider-defined',
    license: 'GPL-3.0',
    commercialUse: 'conditional',
    notes: 'Useful dubbing workflow reference; external/reference boundary unless GPL obligations are intentionally accepted.',
  }),
]);

export function getDirectorVoiceProviderProfile(id: string): VoiceProviderProfile | undefined {
  return DIRECTOR_VOICE_PROVIDER_PROFILES.find((profile) => profile.id === id);
}
