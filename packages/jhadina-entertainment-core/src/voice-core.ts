export type VoiceDelivery = 'neutral' | 'warm' | 'playful' | 'dry' | 'sharp' | 'serious' | 'excited';

export interface VoiceProfile {
  voiceId: string;
  pitch: number;
  pitchVariation: number;
  rate: number;
  energy: number;
  warmth: number;
  dryness: number;
  directness: number;
}

export interface SpeechPlan {
  text: string;
  delivery: VoiceDelivery;
  rate: number;
  pitch: number;
  energy: number;
  pausesMs: number[];
  emphasis: string[];
  laughAt?: number[];
}

export interface VoiceState {
  delivery?: VoiceDelivery;
  emotionalIntensity: number;
  humor: number;
  serious: boolean;
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Converts conversational state into a renderer-neutral speech plan. TTS is only a renderer. */
export function buildSpeechPlan(profile: VoiceProfile, state: VoiceState, text: string): SpeechPlan {
  const delivery: VoiceDelivery = state.delivery ?? (state.serious ? 'serious' : state.humor > 0.65 ? 'playful' : 'neutral');
  const intensity = clamp(state.emotionalIntensity);
  const rate = profile.rate + (delivery === 'excited' ? 0.15 : delivery === 'serious' ? -0.08 : 0) + intensity * 0.05;
  const energy = clamp(profile.energy + (delivery === 'sharp' ? 0.12 : delivery === 'serious' ? -0.1 : 0) + intensity * 0.08);
  const pitch = clamp(profile.pitch + (delivery === 'excited' ? 0.08 : delivery === 'serious' ? -0.06 : 0));
  const pausesMs = text.length > 80 ? [220] : delivery === 'dry' || delivery === 'sharp' ? [140] : [];
  return {
    text,
    delivery,
    rate: clamp(rate),
    pitch: clamp(pitch),
    energy,
    pausesMs,
    emphasis: delivery === 'sharp' || delivery === 'playful' ? text.split(/\s+/).filter((word) => word.length >= 7).slice(0, 2) : [],
  };
}

export interface VoiceRenderer {
  synthesize(plan: SpeechPlan): Promise<unknown>;
}
