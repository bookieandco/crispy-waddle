import type { GrowthOpportunity } from './opportunity-engine.js';

export type CreativeAngle =
  | 'problem_solution'
  | 'curiosity'
  | 'benefit'
  | 'proof'
  | 'contrarian'
  | 'ugc';

export interface CreativeAnglePlan {
  angle: CreativeAngle;
  label: string;
  hook: string;
  rationale: string;
}

const ANGLES: readonly CreativeAngle[] = [
  'problem_solution',
  'curiosity',
  'benefit',
  'proof',
  'contrarian',
  'ugc',
];

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function planCreativeAngles(opportunity: GrowthOpportunity): CreativeAnglePlan[] {
  const key = clean(opportunity.key);
  const rationale = clean(opportunity.rationale || 'Opportunity identified by Growth Core.');

  return ANGLES.map((angle, index) => {
    const hooks: Record<CreativeAngle, string> = {
      problem_solution: `The easiest way to solve ${key}`,
      curiosity: `Most people are missing this about ${key}`,
      benefit: `What ${key} can do for you`,
      proof: `Here's the evidence behind ${key}`,
      contrarian: `Stop doing ${key} the usual way`,
      ugc: `I tested ${key} so you don't have to`,
    };

    return {
      angle,
      label: `${angle.replace('_', ' ')} — ${key}`,
      hook: hooks[angle],
      rationale: index === 0 ? rationale : `Variant angle for ${key}.`,
    };
  });
}

export function selectCreativeAngles(
  opportunity: GrowthOpportunity,
  limit = 3,
): CreativeAnglePlan[] {
  if (limit <= 0) return [];
  return planCreativeAngles(opportunity).slice(0, limit);
}
