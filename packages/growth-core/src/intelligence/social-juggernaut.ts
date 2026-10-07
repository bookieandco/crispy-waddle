import type { GrowthId } from '../domain/types.js';

export type SocialJuggernautMode = 'SEARCH' | 'ATTACK';

export type SocialPortfolioSubjectKind =
  | 'brand'
  | 'product'
  | 'music'
  | 'venture'
  | 'owned_media'
  | 'campaign';

export type SocialPortfolioObjective =
  | 'discovery'
  | 'recognition'
  | 'qualified_traffic'
  | 'music_transfer'
  | 'direct_capture'
  | 'lead_generation'
  | 'product_sale'
  | 'relationship_depth'
  | 'authority'
  | 'retargeting_seed';

export type SocialContentLane =
  | 'reach_engine'
  | 'relationship'
  | 'authority'
  | 'conversion';

export type SocialNativeFormat =
  | 'short_video'
  | 'long_video'
  | 'carousel'
  | 'story'
  | 'image'
  | 'text_post'
  | 'thread'
  | 'discussion'
  | 'pin';

export interface SocialPortfolioSubject {
  id: GrowthId;
  kind: SocialPortfolioSubjectKind;
  brandId: GrowthId;
  label: string;
  audienceSignals: readonly string[];
  objectives: readonly SocialPortfolioObjective[];
  preferredSurfaces: readonly string[];
  evidenceRefs: readonly string[];
  scores: Readonly<{
    businessValue: number;
    evidenceQuality: number;
    contentReadiness: number;
    learningValue: number;
    urgency: number;
  }>;
  validatedWinningMechanic?: Readonly<{
    id: string;
    evidenceRefs: readonly string[];
  }>;
}

export interface SocialNativeVariantPlan {
  id: string;
  subjectId: GrowthId;
  surface: string;
  platform: string;
  lane: SocialContentLane;
  objective: SocialPortfolioObjective;
  format: SocialNativeFormat;
  sourcePolicy: 'REUSE_FIRST';
  sourceSafe: true;
  platformNative: true;
  requiresPublicationApproval: true;
  evidenceRefs: readonly string[];
}

export interface SocialPortfolioRank {
  subjectId: GrowthId;
  score: number;
  priority: 'high' | 'medium' | 'low';
  reasons: readonly string[];
  evidenceRefs: readonly string[];
}

export interface SocialJuggernautPlan {
  subjectId: GrowthId;
  brandId: GrowthId;
  mode: SocialJuggernautMode;
  priorityScore: number;
  variants: readonly SocialNativeVariantPlan[];
  adjacentSurfaces: readonly string[];
  measurement: Readonly<{
    primary: readonly string[];
    diagnostics: readonly string[];
    law: 'QUALIFIED_BUSINESS_OUTCOMES_OVER_VANITY';
  }>;
  operatingPolicy: Readonly<{
    reuseBeforeCreate: true;
    sourceSafeMedia: true;
    nativeVariantsInsteadOfBlindCrossPost: true;
    consentRequiredForDirectCapture: true;
    blockedAutomation: readonly [
      'follow_unfollow',
      'bulk_account_creation',
      'credential_cookie_scraping',
      'proxy_evasion',
      'mass_unsolicited_engagement',
    ];
  }>;
  authority: 'PLANNING_ONLY';
  publicationAuthority: 'NONE';
  messagingAuthority: 'NONE';
  paidMediaAuthority: 'NONE';
}

const DEFAULT_FORMATS: Readonly<Record<string, Readonly<Record<SocialContentLane, SocialNativeFormat>>>> =
  Object.freeze({
    instagram: Object.freeze({
      reach_engine: 'short_video',
      relationship: 'story',
      authority: 'carousel',
      conversion: 'short_video',
    }),
    tiktok: Object.freeze({
      reach_engine: 'short_video',
      relationship: 'short_video',
      authority: 'short_video',
      conversion: 'short_video',
    }),
    youtube: Object.freeze({
      reach_engine: 'short_video',
      relationship: 'short_video',
      authority: 'long_video',
      conversion: 'short_video',
    }),
    facebook: Object.freeze({
      reach_engine: 'short_video',
      relationship: 'text_post',
      authority: 'carousel',
      conversion: 'short_video',
    }),
    x: Object.freeze({
      reach_engine: 'text_post',
      relationship: 'text_post',
      authority: 'thread',
      conversion: 'text_post',
    }),
    linkedin: Object.freeze({
      reach_engine: 'text_post',
      relationship: 'text_post',
      authority: 'carousel',
      conversion: 'carousel',
    }),
    threads: Object.freeze({
      reach_engine: 'text_post',
      relationship: 'text_post',
      authority: 'thread',
      conversion: 'text_post',
    }),
    bluesky: Object.freeze({
      reach_engine: 'text_post',
      relationship: 'text_post',
      authority: 'thread',
      conversion: 'text_post',
    }),
    reddit: Object.freeze({
      reach_engine: 'discussion',
      relationship: 'discussion',
      authority: 'discussion',
      conversion: 'discussion',
    }),
    snapchat: Object.freeze({
      reach_engine: 'short_video',
      relationship: 'story',
      authority: 'short_video',
      conversion: 'short_video',
    }),
    tumblr: Object.freeze({
      reach_engine: 'image',
      relationship: 'text_post',
      authority: 'text_post',
      conversion: 'image',
    }),
    vk: Object.freeze({
      reach_engine: 'short_video',
      relationship: 'text_post',
      authority: 'text_post',
      conversion: 'short_video',
    }),
    pinterest: Object.freeze({
      reach_engine: 'pin',
      relationship: 'pin',
      authority: 'pin',
      conversion: 'pin',
    }),
  });

const BLOCKED_AUTOMATION = Object.freeze([
  'follow_unfollow',
  'bulk_account_creation',
  'credential_cookie_scraping',
  'proxy_evasion',
  'mass_unsolicited_engagement',
] as const);

const PRIMARY_MEASUREMENT = Object.freeze([
  'qualified_engagement',
  'watch_seconds',
  'shares',
  'saves',
  'profile_visits',
  'destination_actions',
  'direct_captures',
  'leads',
  'orders',
  'revenue',
] as const);

const DIAGNOSTIC_MEASUREMENT = Object.freeze([
  'impressions',
  'views',
  'likes',
  'comments',
  'followers',
] as const);

export function compileSocialJuggernautPlan(
  subject: SocialPortfolioSubject,
): SocialJuggernautPlan {
  validateSubject(subject);

  const socialSurfaces = unique(subject.preferredSurfaces)
    .filter((surface) => surface.startsWith('social:'));
  const adjacentSurfaces = unique(subject.preferredSurfaces)
    .filter((surface) => !surface.startsWith('social:'));

  if (!socialSurfaces.length) {
    throw new Error('SOCIAL_JUGGERNAUT_SOCIAL_SURFACE_REQUIRED');
  }

  const lanes = selectLanes(subject.objectives);
  const variants = socialSurfaces.flatMap((surface) => {
    const platform = surface.slice('social:'.length).trim().toLowerCase();
    if (!platform) throw new Error('SOCIAL_JUGGERNAUT_PLATFORM_REQUIRED');

    return lanes.map((lane) => Object.freeze({
      id: `social-juggernaut:${safe(subject.id)}:${safe(platform)}:${lane}`,
      subjectId: subject.id,
      surface,
      platform,
      lane,
      objective: objectiveForLane(lane, subject.objectives),
      format: formatFor(platform, lane),
      sourcePolicy: 'REUSE_FIRST' as const,
      sourceSafe: true as const,
      platformNative: true as const,
      requiresPublicationApproval: true as const,
      evidenceRefs: Object.freeze(unique([
        ...subject.evidenceRefs,
        ...(subject.validatedWinningMechanic?.evidenceRefs ?? []),
      ])),
    }));
  });

  const mode: SocialJuggernautMode = subject.validatedWinningMechanic
    ? 'ATTACK'
    : 'SEARCH';

  return Object.freeze({
    subjectId: subject.id,
    brandId: subject.brandId,
    mode,
    priorityScore: portfolioPriorityScore(subject.scores),
    variants: Object.freeze(variants),
    adjacentSurfaces: Object.freeze(adjacentSurfaces),
    measurement: Object.freeze({
      primary: PRIMARY_MEASUREMENT,
      diagnostics: DIAGNOSTIC_MEASUREMENT,
      law: 'QUALIFIED_BUSINESS_OUTCOMES_OVER_VANITY' as const,
    }),
    operatingPolicy: Object.freeze({
      reuseBeforeCreate: true as const,
      sourceSafeMedia: true as const,
      nativeVariantsInsteadOfBlindCrossPost: true as const,
      consentRequiredForDirectCapture: true as const,
      blockedAutomation: BLOCKED_AUTOMATION,
    }),
    authority: 'PLANNING_ONLY' as const,
    publicationAuthority: 'NONE' as const,
    messagingAuthority: 'NONE' as const,
    paidMediaAuthority: 'NONE' as const,
  });
}

export function rankSocialPortfolio(
  subjects: readonly SocialPortfolioSubject[],
): SocialPortfolioRank[] {
  return subjects
    .map((subject) => {
      validateSubject(subject);
      const score = portfolioPriorityScore(subject.scores);
      const reasons = [
        `businessValue=${subject.scores.businessValue}`,
        `evidenceQuality=${subject.scores.evidenceQuality}`,
        `contentReadiness=${subject.scores.contentReadiness}`,
        `learningValue=${subject.scores.learningValue}`,
        `urgency=${subject.scores.urgency}`,
      ];
      return Object.freeze({
        subjectId: subject.id,
        score,
        priority: score >= 75 ? 'high' as const : score >= 55 ? 'medium' as const : 'low' as const,
        reasons: Object.freeze(reasons),
        evidenceRefs: Object.freeze(unique(subject.evidenceRefs)),
      });
    })
    .sort((a, b) => b.score - a.score);
}

function selectLanes(
  objectives: readonly SocialPortfolioObjective[],
): readonly SocialContentLane[] {
  const lanes = new Set<SocialContentLane>();

  if (objectives.some((objective) => [
    'discovery',
    'recognition',
    'qualified_traffic',
    'music_transfer',
    'retargeting_seed',
  ].includes(objective))) {
    lanes.add('reach_engine');
  }

  if (objectives.some((objective) => [
    'relationship_depth',
    'direct_capture',
    'music_transfer',
  ].includes(objective))) {
    lanes.add('relationship');
  }

  if (objectives.includes('authority')) {
    lanes.add('authority');
  }

  if (objectives.some((objective) => [
    'direct_capture',
    'lead_generation',
    'product_sale',
    'qualified_traffic',
    'music_transfer',
  ].includes(objective))) {
    lanes.add('conversion');
  }

  if (!lanes.size) lanes.add('reach_engine');
  return Object.freeze([...lanes]);
}

function objectiveForLane(
  lane: SocialContentLane,
  objectives: readonly SocialPortfolioObjective[],
): SocialPortfolioObjective {
  const preference: Readonly<Record<SocialContentLane, readonly SocialPortfolioObjective[]>> =
    Object.freeze({
      reach_engine: Object.freeze([
        'discovery',
        'recognition',
        'qualified_traffic',
        'music_transfer',
        'retargeting_seed',
      ]),
      relationship: Object.freeze([
        'relationship_depth',
        'direct_capture',
        'music_transfer',
        'recognition',
      ]),
      authority: Object.freeze([
        'authority',
        'recognition',
        'qualified_traffic',
      ]),
      conversion: Object.freeze([
        'product_sale',
        'lead_generation',
        'direct_capture',
        'music_transfer',
        'qualified_traffic',
      ]),
    });

  return preference[lane].find((objective) => objectives.includes(objective))
    ?? objectives[0]
    ?? 'discovery';
}

function formatFor(platform: string, lane: SocialContentLane): SocialNativeFormat {
  return DEFAULT_FORMATS[platform]?.[lane] ?? (
    lane === 'authority'
      ? 'text_post'
      : lane === 'relationship'
        ? 'text_post'
        : 'short_video'
  );
}

function portfolioPriorityScore(scores: SocialPortfolioSubject['scores']): number {
  return round(
    scores.businessValue * 0.30
      + scores.evidenceQuality * 0.25
      + scores.contentReadiness * 0.20
      + scores.learningValue * 0.15
      + scores.urgency * 0.10,
  );
}

function validateSubject(subject: SocialPortfolioSubject): void {
  requireText(subject.id, 'subject.id');
  requireText(subject.brandId, 'subject.brandId');
  requireText(subject.label, 'subject.label');

  if (!subject.audienceSignals.length) {
    throw new Error('SOCIAL_JUGGERNAUT_AUDIENCE_REQUIRED');
  }
  if (!subject.objectives.length) {
    throw new Error('SOCIAL_JUGGERNAUT_OBJECTIVE_REQUIRED');
  }
  if (!subject.preferredSurfaces.length) {
    throw new Error('SOCIAL_JUGGERNAUT_SURFACE_REQUIRED');
  }
  if (!subject.evidenceRefs.length) {
    throw new Error('SOCIAL_JUGGERNAUT_EVIDENCE_REQUIRED');
  }

  for (const [name, value] of Object.entries(subject.scores)) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`SOCIAL_JUGGERNAUT_SCORE_INVALID:${name}`);
    }
  }

  if (subject.validatedWinningMechanic) {
    requireText(subject.validatedWinningMechanic.id, 'validatedWinningMechanic.id');
    if (!subject.validatedWinningMechanic.evidenceRefs.length) {
      throw new Error('SOCIAL_JUGGERNAUT_WINNER_EVIDENCE_REQUIRED');
    }
  }
}

function requireText(value: string, field: string): void {
  if (!value.trim()) throw new Error(`SOCIAL_JUGGERNAUT_FIELD_REQUIRED:${field}`);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function safe(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]+/g, '-').slice(0, 120);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
