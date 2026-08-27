export type SamNoticeType = 'SOLICITATION' | 'SOURCES_SOUGHT' | 'SPECIAL_NOTICE' | 'PRESOLICITATION' | 'AWARD_NOTICE' | 'OTHER';

export type OpportunityDisposition = 'PURSUE' | 'PARTNER' | 'MONITOR' | 'PASS';

export interface SamOpportunity {
  noticeId: string;
  title: string;
  noticeType: SamNoticeType;
  agency?: string;
  office?: string;
  postedDate?: string;
  responseDeadline?: string;
  naics?: string;
  setAside?: string;
  placeOfPerformance?: string;
  estimatedValue?: number;
  description?: string;
  sourceUrl?: string;
}

export interface OpportunityScore {
  capability: number;
  timing: number;
  value: number;
  competition: number;
  execution: number;
  partnerFit: number;
  total: number;
  disposition: OpportunityDisposition;
  reasons: string[];
}
