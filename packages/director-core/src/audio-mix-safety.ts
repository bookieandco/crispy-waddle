export type AudioMixRole = 'dialogue' | 'music' | 'foley' | 'sfx' | 'ambience';

export interface AudioMixLayer {
  id: string;
  assetId: string;
  role: AudioMixRole;
  startSeconds: number;
  endSeconds: number;
  gainDb: number;
  pan?: number;
  duckUnderRoles?: readonly AudioMixRole[];
  limiterPeakDbfs?: number;
  evidenceIds: readonly string[];
}

export interface AudioMixSafetyDecision {
  admissible: boolean;
  reasons: readonly string[];
}

export function validateAudioMixSafety(
  layers: readonly AudioMixLayer[],
  policy: {
    minimumPeakHeadroomDb: number;
    maximumLayerGainDb: number;
    requireDialogueDuckingForFoley: boolean;
  },
): AudioMixSafetyDecision {
  const reasons: string[] = [];
  for (const layer of layers) {
    if (!layer.id.trim() || !layer.assetId.trim()) reasons.push(`DIRECTOR_AUDIO_LAYER_IDENTITY_REQUIRED:${layer.id}`);
    if (
      !Number.isFinite(layer.startSeconds) ||
      !Number.isFinite(layer.endSeconds) ||
      layer.startSeconds < 0 ||
      layer.endSeconds <= layer.startSeconds
    ) reasons.push(`DIRECTOR_AUDIO_LAYER_RANGE_INVALID:${layer.id}`);
    if (!Number.isFinite(layer.gainDb) || layer.gainDb > policy.maximumLayerGainDb) {
      reasons.push(`DIRECTOR_AUDIO_LAYER_GAIN_UNSAFE:${layer.id}`);
    }
    if (layer.pan !== undefined && (!Number.isFinite(layer.pan) || layer.pan < -1 || layer.pan > 1)) {
      reasons.push(`DIRECTOR_AUDIO_LAYER_PAN_INVALID:${layer.id}`);
    }
    if (!layer.evidenceIds.length) reasons.push(`DIRECTOR_AUDIO_LAYER_EVIDENCE_REQUIRED:${layer.id}`);
    if (
      layer.limiterPeakDbfs !== undefined &&
      layer.limiterPeakDbfs > -policy.minimumPeakHeadroomDb
    ) reasons.push(`DIRECTOR_AUDIO_LAYER_HEADROOM_UNSAFE:${layer.id}`);
  }

  if (policy.requireDialogueDuckingForFoley) {
    const dialogue = layers.filter((layer) => layer.role === 'dialogue');
    const foley = layers.filter((layer) => layer.role === 'foley');
    for (const cue of foley) {
      const overlapsDialogue = dialogue.some(
        (voice) => cue.startSeconds < voice.endSeconds && cue.endSeconds > voice.startSeconds,
      );
      if (overlapsDialogue && !cue.duckUnderRoles?.includes('dialogue')) {
        reasons.push(`DIRECTOR_FOLEY_DIALOGUE_DUCKING_REQUIRED:${cue.id}`);
      }
    }
  }

  return Object.freeze({ admissible: reasons.length === 0, reasons: Object.freeze(reasons) });
}
