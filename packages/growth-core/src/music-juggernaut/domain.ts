export type MusicCampaignState =
  | 'INGESTED'
  | 'EXPLORING'
  | 'EARLY_SIGNAL'
  | 'VALIDATING'
  | 'PROVEN'
  | 'SCALING'
  | 'STEADY_STATE'
  | 'REPACKAGE'
  | 'CAPITAL_STOP'
  | 'CATALOG_HOLD'
  | 'RESURRECTED';

export type FanStage =
  | 'VIEWER'
  | 'FOLLOWER'
  | 'RETURNER'
  | 'LISTENER'
  | 'DIRECT_FAN'
  | 'COMMUNITY'
  | 'BUYER'
  | 'ADVOCATE';

export type JuggernautMode = 'SEARCH' | 'ATTACK';

export type MusicAssetKind =
  | 'song'
  | 'snippet'
  | 'remix'
  | 'live_version'
  | 'performance'
  | 'mini_music_video'
  | 'location_performance'
  | 'story'
  | 'meme'
  | 'ugc'
  | 'email'
  | 'offer'
  | 'show';

export interface EvidenceRef {
  id: string;
  source: string;
  observedAt: string;
  confidence: number;
}

export interface ArtistKernel {
  artistId: string;
  story: readonly string[];
  personalityTraits: readonly string[];
  tasteSignals: readonly string[];
  sonicSignatures: readonly string[];
  visualSignatures: readonly string[];
  antiSignatures: readonly string[];
  superpowers: readonly string[];
  evidenceRefs: readonly string[];
}

export interface SongSection {
  id: string;
  songId: string;
  startMs: number;
  endMs: number;
  label: string;
  functions: readonly ('lyric'|'melody'|'emotion'|'meme'|'performance'|'loop'|'structure')[];
}

export interface SongRecord {
  id: string;
  title: string;
  status: 'unreleased'|'released'|'catalog';
  artistConviction: number;
  sections: readonly SongSection[];
  rightsState: 'clear'|'review_required'|'blocked';
  releaseDate?: string;
  evidenceRefs: readonly string[];
}

export interface ContentExperiment {
  id: string;
  songId: string;
  sectionId?: string;
  hypothesis: string;
  contentFamily: string;
  platform: string;
  audience?: string;
  spendMinor: number;
  currency: string;
  sampleTarget: number;
  successSignal: string;
  failureSignal: string;
  status: 'planned'|'running'|'complete'|'stopped';
  evidenceRefs: readonly string[];
}

export interface PerformanceObservation {
  id: string;
  experimentId: string;
  exposures: number;
  views: number;
  engagedViews?: number;
  shares: number;
  saves: number;
  comments: number;
  profileVisits: number;
  songActions: number;
  directFanCaptures: number;
  purchases?: number;
  revenueMinor?: number;
  botRisk: number;
  attributionConfidence: number;
  observedAt: string;
  evidenceRefs: readonly string[];
}

export interface CreativeOutlier {
  experimentId: string;
  relativeLift: number;
  confidence: number;
  replicationCount: number;
  status: 'insufficient_sample'|'interesting'|'validated';
  reasons: readonly string[];
  evidenceRefs: readonly string[];
}

export interface BreakoutSignal {
  id: string;
  songId: string;
  trigger: 'creative_outlier'|'stream_acceleration'|'ugc_acceleration'|'industry_support'|'city_demand';
  strength: number;
  evidenceRefs: readonly string[];
}

export interface BreakoutWindow {
  songId: string;
  openedAt: string;
  state: 'OPEN'|'COOLING'|'CLOSED';
  signals: readonly BreakoutSignal[];
  priorities: readonly string[];
  evidenceRefs: readonly string[];
}

export interface FanRecord {
  id: string;
  stage: FanStage;
  city?: string;
  consent: Readonly<Partial<Record<'email'|'sms'|'community'|'dm', boolean>>>;
  repeatInteractions: number;
  purchases: number;
  showsAttended: number;
  advocacySignals: number;
  lastSeenAt: string;
  evidenceRefs: readonly string[];
}

export interface CityDemand {
  city: string;
  listeners: number;
  directFans: number;
  showInterest: number;
  priorAttendees: number;
  repeatFans: number;
  evidenceRefs: readonly string[];
}

export interface VenueRecommendation {
  city: string;
  recommendedCapacity: number;
  confidence: number;
  reasons: readonly string[];
  authority: 'ANALYSIS_ONLY';
}

export interface PromotionBudget {
  approvedMinor: number;
  spentMinor: number;
  experimentReserveMinor: number;
  breakoutReserveMinor: number;
  productionReserveMinor: number;
  currency: string;
}

export interface SpendDecision {
  action: 'HOLD'|'MICRO_TEST'|'CONTROLLED_SCALE'|'ROTATE'|'STOP';
  authorizedMinor: number;
  reasons: readonly string[];
  evidenceRefs: readonly string[];
  requiresApproval: boolean;
}

export interface RightsRecord {
  assetId: string;
  masterOwnershipKnown: boolean;
  publishingKnown: boolean;
  sampleStatus: 'none'|'cleared'|'review_required'|'blocked';
  thirdPartyUsageStatus: 'none'|'cleared'|'review_required'|'blocked';
  evidenceRefs: readonly string[];
}

export interface DealPrecheck {
  guaranteedCashMinor: number;
  optionalCashMinor: number;
  termMonths?: number;
  revenueParticipation: readonly string[];
  masterGrant?: string;
  publishingGrant?: string;
  recoupmentKnown: boolean;
  terminationKnown: boolean;
  reversionKnown: boolean;
  requiresAttorneyReview: true;
  blockers: readonly string[];
  evidenceRefs: readonly string[];
}

export interface ArtistCommand {
  priority: number;
  kind: 'create'|'fan'|'live'|'money'|'catalog'|'network'|'rights'|'review';
  instruction: string;
  reason: string;
  evidenceRefs: readonly string[];
}

export interface JuggernautSnapshot {
  artistId: string;
  mode: JuggernautMode;
  songs: readonly SongRecord[];
  experiments: readonly ContentExperiment[];
  observations: readonly PerformanceObservation[];
  fans: readonly FanRecord[];
  cityDemand: readonly CityDemand[];
  budget: PromotionBudget;
  breakout?: BreakoutWindow;
}
