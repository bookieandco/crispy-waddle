export type OpportunityStrategy =
  | 'service'
  | 'productized_service'
  | 'digital_product'
  | 'affiliate'
  | 'ecommerce'
  | 'government_contract'
  | 'subcontracting'
  | 'partnership'
  | 'software'
  | 'media'
  | 'audience'
  | 'asset'
  | 'experiment'

export const OPPORTUNITY_STRATEGIES: readonly OpportunityStrategy[] = [
  'service',
  'productized_service',
  'digital_product',
  'affiliate',
  'ecommerce',
  'government_contract',
  'subcontracting',
  'partnership',
  'software',
  'media',
  'audience',
  'asset',
  'experiment',
] as const
