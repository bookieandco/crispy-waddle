import type { DirectorControls } from './types.js';
import type { DirectorTasteProfile } from './director-taste.js';
import { applyDirectorTasteToControls } from './director-taste-controls.js';

export interface DirectorPersonalitySliders {
  humor?: number;
  playfulness?: number;
  curiosity?: number;
  intensity?: number;
  formality?: number;
  riskTolerance?: number;
}

export type DirectorSituation = 'playful' | 'focused' | 'serious' | 'sensitive' | 'urgent';

export interface DirectorContext {
  sliders: DirectorPersonalitySliders;
  situation: DirectorSituation;
  taste: DirectorTasteProfile;
}

export interface DirectorExpression {
  tone: 'playful' | 'warm' | 'focused' | 'serious';
  energy: number;
  jokePermission: number;
  creativeRisk: number;
}

export function expressDirectorContext(context: DirectorContext): DirectorExpression {
  const { sliders, situation } = context;
  const playfulness = sliders.playfulness ?? 50;
  const intensity = sliders.intensity ?? 50;
  const risk = sliders.riskTolerance ?? 50;

  if (situation === 'serious' || situation === 'sensitive' || situation === 'urgent') {
    return { tone: 'serious', energy: intensity, jokePermission: 0, creativeRisk: Math.min(risk, 60) };
  }
  if (situation === 'focused') {
    return { tone: 'focused', energy: intensity, jokePermission: Math.min(playfulness, 25), creativeRisk: risk };
  }
  return {
    tone: playfulness >= 70 ? 'playful' : 'warm',
    energy: intensity,
    jokePermission: playfulness,
    creativeRisk: risk,
  };
}

export function applyJhadinaDirectorContext(
  controls: DirectorControls,
  context: DirectorContext,
): DirectorControls {
  const expression = expressDirectorContext(context);
  const learned = applyDirectorTasteToControls(controls, context.taste);
  return {
    ...learned,
    performanceIntensity: learned.performanceIntensity ?? expression.energy,
  };
}
