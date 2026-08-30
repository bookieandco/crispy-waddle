export type OpportunityClass =
  | 'earn'
  | 'freelance'
  | 'product'
  | 'arbitrage'
  | 'ai_business'
  | 'partnership'
  | 'asset'
  | 'experiment'

export const OPPORTUNITY_CLASSES: readonly OpportunityClass[] = [
  'earn',
  'freelance',
  'product',
  'arbitrage',
  'ai_business',
  'partnership',
  'asset',
  'experiment',
] as const
