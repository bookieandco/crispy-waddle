import type { DirectorControls } from './types.js';
import type { DirectorTasteProfile } from './director-taste.js';

export type SituationalMode = 'playful' | 'focused' | 'serious' | 'sensitive' | 'urgent';

export interface PersonalitySliders {
  humor: number;
  playfulness: number;
  curiosity: number;
  boldness: number;
  warmth: number;
  formality: number;
}

export interface DirectorDecisionContext {
  sliders: PersonalitySliders;
  mode: SituationalMode;
  taste: DirectorTasteProfile;
  storyIntent: string;
}

export interface DirectorDecisionGuidance {
  controls: DirectorControls;
  promptNotes: string[];
  tone: 'playful' | 'professional' | 'serious' | 'urgent';
  jokePermission: number;
  creativeRisk: number;
}

export function buildDirectorDecisionGuidance(context: DirectorDecisionContext): DirectorDecisionGuidance {
  const tasteSignals = context.taste.signals ?? [];
  const positive = tasteSignals.filter((s) => s.sentiment >= 50 && s.confidence >= 50);
  const controls: DirectorControls = {};
  const promptNotes = [`Story intent: ${context.storyIntent}.`];

  const style = positive.find((s) => s.category === 'style');
  const mood = positive.find((s) => s.category === 'mood');
  if (style) controls.lookPreset = style.subject;
  if (mood) controls.lightingMood = mood.subject;

  let tone: DirectorDecisionGuidance['tone'] = context.sliders.formality >= 70 ? 'professional' : 'playful';
  let jokePermission = context.sliders.humor;
  let creativeRisk = context.sliders.boldness;

  if (context.mode === 'focused') {
    tone = 'professional';
    jokePermission = Math.min(jokePermission, 25);
  } else if (context.mode === 'serious' || context.mode === 'sensitive') {
    tone = 'serious';
    jokePermission = 0;
    creativeRisk = Math.min(creativeRisk, 45);
  } else if (context.mode === 'urgent') {
    tone = 'urgent';
    jokePermission = 0;
    creativeRisk = Math.min(creativeRisk, 20);
  }

  if (context.sliders.playfulness >= 75 && context.mode === 'playful') promptNotes.push('Allow playful creative choices when they serve the story.');
  if (context.sliders.curiosity >= 75) promptNotes.push('Explore novel visual possibilities without violating story intent.');
  if (context.sliders.warmth >= 75) promptNotes.push('Favor human, emotionally attentive direction when appropriate.');

  promptNotes.push(`Situational mode: ${context.mode}. Joke permission: ${jokePermission}/100. Creative risk: ${creativeRisk}/100.`);
  return { controls, promptNotes, tone, jokePermission, creativeRisk };
}
