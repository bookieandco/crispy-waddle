export interface MoneyCapabilityProfile {
  capabilities: string[];
  preferredNaics: string[];
  preferredSetAsides: string[];
  maxDaysToDeadline: number;
  minEstimatedValue: number;
}

/**
 * Initial Jhadina commercial capability profile.
 * Keep this conservative: unknown capability is a gap until evidence is added.
 */
export const JHADINA_MONEY_PROFILE: MoneyCapabilityProfile = {
  capabilities: [
    'software development',
    'web application development',
    'ai automation',
    'artificial intelligence',
    'data analysis',
    'data integration',
    'information technology',
    'technical consulting',
    'digital services',
  ],
  preferredNaics: ['541511', '541512', '541519', '541611', '541690'],
  preferredSetAsides: ['SBA', 'SMALL BUSINESS', '8(A)', 'HUBZONE', 'WOMEN OWNED', 'VETERAN'],
  maxDaysToDeadline: 45,
  minEstimatedValue: 0,
};
