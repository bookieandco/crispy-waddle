import type { BehavioralState } from '@jhadina/core-spine';
import type { DirectorControls } from './types.js';
import type { DirectorTasteProfile } from './director-taste.js';

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
  mode: 'playful' | 'focused' | 'serious' | 'sensitive' | 'urgent';
  taste: DirectorTasteProfile;
  storyIntent: string;
  behavioralState?: BehavioralState;
}

export interface DirectorDecisionGuidance {
  controls: DirectorControls;
  promptNotes: string[];
  tone: 'playful' | 'professional' | 'serious' | 'urgent';
  jokePermission: number;
  creativeRisk: number;
}

export function buildDirectorDecisionGuidance(context: DirectorDecisionContext): DirectorDecisionGuidance {
  const state = context.behavioralState;
  const humor = state?.sliders.humor ?? context.sliders.humor;
  const playfulness = state?.sliders.playfulness ?? context.sliders.playfulness;
  const warmth = state?.sliders.warmth ?? context.sliders.warmth;
  const creativeRisk = state?.sliders.boldness ?? context.sliders.boldness;
  const formality = context.sliders.formality;
  const tone = state?.mode === 'urgent' ? 'urgent' : state?.mode === 'serious' || state?.mode === 'sensitive' ? 'serious' : formality >= 70 ? 'professional' : 'playful';
  const jokePermission = state?.mode === 'urgent' ? 0 : state?.mode === 'serious' || state?.mode === 'sensitive' ? 0 : Math.min(100, humor);
  const promptNotes = [`Story intent: ${context.storyIntent}.`, `Situational mode: ${state?.mode ?? context.mode}. Joke permission: ${jokePermission}/100. Creative risk: ${creativeRisk}/100.`];
  if (playfulness >= 75 && jokePermission >= 60) promptNotes.push('Allow playful creative choices when they serve the story.');
  if (context.sliders.curiosity >= 75) promptNotes.push('Explore novel visual possibilities without violating story intent.');
  if (warmth >= 75) promptNotes.push('Favor human, emotionally attentive direction when appropriate.');
  return { controls: {}, promptNotes, tone, jokePermission, creativeRisk };
}
