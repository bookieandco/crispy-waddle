export type DirectorVideoFormat =
  | 'long-form'
  | 'short-form'
  | 'faceless'
  | 'cartoon'
  | 'hybrid';

export type DirectorProductionCapability =
  | 'script'
  | 'storyboard'
  | 'shotlist'
  | 'take-generation'
  | 'take-observation'
  | 'take-selection'
  | 'timeline-edit'
  | 'locked-character'
  | 'animation'
  | 'voice-sync'
  | 'foley'
  | 'music'
  | 'captions'
  | 'rights'
  | 'render'
  | 'render-inspection'
  | 'media-qc'
  | 'review';

function productionCapabilities(...values: DirectorProductionCapability[]): readonly DirectorProductionCapability[] {
  return Object.freeze(values);
}

export interface VideoProductionProfile {
  id: string;
  format: DirectorVideoFormat;
  requiredCapabilities: readonly DirectorProductionCapability[];
  optionalCapabilities: readonly DirectorProductionCapability[];
  takePolicyId: string;
}

export const DIRECTOR_VIDEO_PROFILES: Readonly<Record<DirectorVideoFormat, VideoProductionProfile>> = Object.freeze({
  'long-form': Object.freeze({
    id: 'director:long-form:v1',
    format: 'long-form',
    requiredCapabilities: productionCapabilities('script','storyboard','shotlist','take-generation','take-observation','take-selection','timeline-edit','music','captions','foley','render','render-inspection','media-qc','review'),
    optionalCapabilities: productionCapabilities('locked-character','animation','voice-sync','rights'),
    takePolicyId: 'long-form:v1',
  }),
  'short-form': Object.freeze({
    id: 'director:short-form:v1',
    format: 'short-form',
    requiredCapabilities: productionCapabilities('script','shotlist','take-generation','take-observation','take-selection','timeline-edit','captions','render','render-inspection','media-qc'),
    optionalCapabilities: productionCapabilities('storyboard','music','foley','voice-sync','rights'),
    takePolicyId: 'short-form:v1',
  }),
  faceless: Object.freeze({
    id: 'director:faceless:v1',
    format: 'faceless',
    requiredCapabilities: productionCapabilities('script','shotlist','take-observation','take-selection','timeline-edit','rights','captions','music','render','render-inspection','media-qc'),
    optionalCapabilities: productionCapabilities('take-generation','storyboard','foley','voice-sync'),
    takePolicyId: 'faceless:v1',
  }),
  cartoon: Object.freeze({
    id: 'director:cartoon:v1',
    format: 'cartoon',
    requiredCapabilities: productionCapabilities('script','storyboard','shotlist','take-generation','take-observation','take-selection','locked-character','animation','voice-sync','foley','music','timeline-edit','render','render-inspection','media-qc','review'),
    optionalCapabilities: productionCapabilities('captions','rights'),
    takePolicyId: 'cartoon:v1',
  }),
  hybrid: Object.freeze({
    id: 'director:hybrid:v1',
    format: 'hybrid',
    requiredCapabilities: productionCapabilities('script','storyboard','shotlist','take-generation','take-observation','take-selection','timeline-edit','rights','render','render-inspection','media-qc','review'),
    optionalCapabilities: productionCapabilities('locked-character','animation','voice-sync','foley','music','captions'),
    takePolicyId: 'long-form:v1',
  }),
});

export interface VideoProductionReadinessDecision {
  ready: boolean;
  missing: readonly DirectorProductionCapability[];
}

export function evaluateVideoProductionReadiness(
  profile: VideoProductionProfile,
  available: readonly DirectorProductionCapability[],
): VideoProductionReadinessDecision {
  const set = new Set(available);
  const missing = profile.requiredCapabilities.filter((capability) => !set.has(capability));
  return Object.freeze({ ready: missing.length === 0, missing: Object.freeze(missing) });
}
