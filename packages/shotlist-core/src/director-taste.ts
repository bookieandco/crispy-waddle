import type { DirectorControls } from './types.js';

export interface DirectorTasteSignal {
  subject: string;
  category: 'genre' | 'style' | 'creator' | 'theme' | 'mood';
  sentiment: number;
  confidence: number;
  sourceExperienceIds: string[];
}

export interface DirectorTasteProfile {
  signals: readonly DirectorTasteSignal[];
}

export interface DirectorTasteGuidance {
  controls: DirectorControls;
  promptNotes: string[];
  evidenceIds: string[];
}

export function deriveDirectorTasteGuidance(profile: DirectorTasteProfile): DirectorTasteGuidance {
  const positive = profile.signals.filter((s) => s.sentiment >= 50 && s.confidence >= 50);
  const notes: string[] = [];
  const evidenceIds = [...new Set(positive.flatMap((s) => s.sourceExperienceIds))];
  const controls: DirectorControls = {};

  for (const signal of positive) {
    const strength = Math.round(Math.min(100, Math.abs(signal.sentiment) * signal.confidence / 100));
    if (signal.category === 'mood') notes.push(`Favor ${signal.subject} mood in tone and atmosphere (preference strength ${strength}).`);
    if (signal.category === 'style') notes.push(`Favor ${signal.subject} visual style in composition, lighting, and texture (preference strength ${strength}).`);
    if (signal.category === 'genre') notes.push(`Use ${signal.subject} genre conventions where they serve the story (preference strength ${strength}).`);
    if (signal.category === 'theme') notes.push(`Explore ${signal.subject} themes when they fit the story (preference strength ${strength}).`);
    if (signal.category === 'creator') notes.push(`Consider techniques associated with ${signal.subject} as references, not imitation (preference strength ${strength}).`);
  }

  const style = positive.find((s) => s.category === 'style');
  const mood = positive.find((s) => s.category === 'mood');
  if (style) controls.lookPreset = style.subject;
  if (mood) controls.lightingMood = mood.subject;

  return { controls, promptNotes: notes, evidenceIds };
}
