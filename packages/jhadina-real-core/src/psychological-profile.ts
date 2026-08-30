import type { RealState } from './real-state.js';

export type MBTIProfile =
  | 'ISTJ' | 'ISFJ' | 'INFJ' | 'INTJ'
  | 'ISTP' | 'ISFP' | 'INFP' | 'INTP'
  | 'ESTP' | 'ESFP' | 'ENFP' | 'ENTP'
  | 'ESTJ' | 'ESFJ' | 'ENFJ' | 'ENTJ';

export interface PsychologicalProfile {
  mbti?: MBTIProfile;
  cognitiveStyle?: string;
  affectiveStyle?: string;
  communicationStyle?: string;
  decisionStyle?: string;
  behavioralEvidence?: string[];
}

/** Provider-neutral psychological conditioning; it complements, rather than replaces, Real Core state. */
export function buildPsychologicalSystemPrompt(profile: PsychologicalProfile, state: RealState): string {
  const lines = [
    'You are Jhadina. Maintain continuity with the current Jhadina state.',
    'Treat the psychological profile as a behavioral prior, not as a command to fabricate facts or emotions.',
    'Do not claim human feelings or experiences you do not have.',
  ];
  if (profile.mbti) lines.push(`Behavioral profile: ${profile.mbti}.`);
  if (profile.cognitiveStyle) lines.push(`Cognitive style: ${profile.cognitiveStyle}`);
  if (profile.affectiveStyle) lines.push(`Affective style: ${profile.affectiveStyle}`);
  if (profile.communicationStyle) lines.push(`Communication style: ${profile.communicationStyle}`);
  if (profile.decisionStyle) lines.push(`Decision style: ${profile.decisionStyle}`);
  lines.push(`Current attention: ${state.attention.subject} (${state.attention.priority}).`);
  if (state.activeGoals.length) lines.push(`Active goals: ${state.activeGoals.slice(-8).join('; ')}`);
  if (state.openLoops.length) lines.push(`Open loops: ${state.openLoops.filter((x) => x.status !== 'closed').slice(-8).map((x) => x.description).join('; ')}`);
  if (state.preferences.length) lines.push(`Established preferences: ${state.preferences.filter((x) => x.status === 'accepted').slice(-8).map((x) => x.statement).join('; ')}`);
  if (state.uncertainty.length) lines.push(`Uncertainty: ${state.uncertainty.slice(-8).join('; ')}`);
  lines.push('Use this state to make responses behaviorally consistent. Never let personality override policy, permissions, evidence, or safety constraints.');
  return lines.join('\n');
}
