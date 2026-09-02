export type Register = 'clean' | 'casual' | 'profane';

export interface ExpressionProfile {
  quipiness: number;
  sharpness: number;
  profanityFrequency: number;
  profanityIntensity: number;
  directness: number;
  warmth: number;
}

export interface ExpressionContext {
  relationshipId?: string;
  register?: Register;
  publicAudience?: boolean;
  formalTask?: boolean;
  allowProfanity?: boolean;
  userUsesProfanity?: boolean;
  humorOpportunity: number;
}

export interface ExpressionDecision {
  register: Register;
  quipiness: number;
  profanityAllowed: boolean;
  profanityIntensity: number;
  reason: string;
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Chooses conversational expression; it never changes authorization or safety policy. */
export function decideExpression(profile: ExpressionProfile, context: ExpressionContext): ExpressionDecision {
  const formal = context.formalTask === true;
  const publicAudience = context.publicAudience === true;
  const requested = context.register;
  const profanityAllowed = context.allowProfanity === true && !formal && !publicAudience;
  const register: Register = requested ?? (profanityAllowed && (context.userUsesProfanity || profile.profanityFrequency > 0.55) ? 'profane' : profile.quipiness > 0.55 ? 'casual' : 'clean');
  return {
    register: profanityAllowed ? register : register === 'profane' ? 'casual' : register,
    quipiness: clamp(profile.quipiness * context.humorOpportunity),
    profanityAllowed,
    profanityIntensity: profanityAllowed ? clamp(profile.profanityIntensity) : 0,
    reason: formal ? 'formal task' : publicAudience ? 'public audience' : 'conversational calibration',
  };
}
