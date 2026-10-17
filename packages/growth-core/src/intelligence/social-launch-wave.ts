import type { GrowthId } from '../domain/types.js';
import type {
  SocialJuggernautPlan,
  SocialPortfolioObjective,
} from './social-juggernaut.js';

export type SocialLaunchPhase =
  | 'strategic_prep'
  | 'asset_prep'
  | 'partner_prep'
  | 'content_prep'
  | 'final_confirm'
  | 'launch'
  | 'momentum';

export interface SocialLaunchWave {
  id: string;
  subjectId: GrowthId;
  phase: SocialLaunchPhase;
  startsAt: string;
  endsAt: string;
  objectives: readonly SocialPortfolioObjective[];
  platformVariants: readonly string[];
  adjacentSurfaces: readonly string[];
  localization: readonly string[];
  jobs: readonly string[];
  evidenceRefs: readonly string[];
  requiresPublicationApproval: true;
  requiresOutreachApproval: true;
  requiresSpendApproval: true;
  authority: 'PLANNING_ONLY';
}

export interface SocialLaunchCampaign {
  subjectId: GrowthId;
  launchAt: string;
  waves: readonly SocialLaunchWave[];
  doctrine: Readonly<{
    simultaneousMultiChannel: true;
    progressiveDepth: true;
    qualityOverSprayAndPray: true;
    localizeWithoutIdentityDrift: true;
    postLaunchMomentumRequired: true;
  }>;
  authority: 'PLANNING_ONLY';
  externalActionAuthorized: false;
}

const DAY = 86_400_000;

const WAVE_SPEC: readonly Readonly<{
  phase: SocialLaunchPhase;
  startDay: number;
  endDay: number;
  jobs: readonly string[];
}>[] = Object.freeze([
  Object.freeze({
    phase: 'strategic_prep',
    startDay: -42,
    endDay: -36,
    jobs: Object.freeze([
      'confirm audience, problem, value proposition, success metrics, keywords, constraints',
      'confirm business outcome instrumentation before content volume',
    ]),
  }),
  Object.freeze({
    phase: 'asset_prep',
    startDay: -35,
    endDay: -28,
    jobs: Object.freeze([
      'inventory reusable product, music, video, image, proof, demo, testimonial and story assets',
      'produce only the missing launch-critical media through Director',
    ]),
  }),
  Object.freeze({
    phase: 'partner_prep',
    startDay: -28,
    endDay: -21,
    jobs: Object.freeze([
      'identify evidence-backed creator, community, press and partner fits',
      'prepare governed outreach proposals without sending them',
    ]),
  }),
  Object.freeze({
    phase: 'content_prep',
    startDay: -21,
    endDay: -8,
    jobs: Object.freeze([
      'compile one launch thesis into platform-native variants',
      'prepare story, proof, tutorial, authority and conversion derivatives',
    ]),
  }),
  Object.freeze({
    phase: 'final_confirm',
    startDay: -7,
    endDay: -1,
    jobs: Object.freeze([
      'freeze approved source assets, destinations, schedules and campaign lineage',
      'validate tracking, landing paths, direct capture, inventory and support readiness',
    ]),
  }),
  Object.freeze({
    phase: 'launch',
    startDay: 0,
    endDay: 4,
    jobs: Object.freeze([
      'run coordinated platform-native launch waves',
      'observe delivery, replies, qualified traffic, capture and conversion continuously',
      'adapt future approved variants from evidence without rewriting already-approved actions',
    ]),
  }),
  Object.freeze({
    phase: 'momentum',
    startDay: 7,
    endDay: 28,
    jobs: Object.freeze([
      'repurpose proof, user reactions, outcomes, tutorials and case studies',
      'continue winning mechanics and retire weak ones using realized business outcomes',
    ]),
  }),
]);

export function compileSocialLaunchCampaign(input: {
  plan: SocialJuggernautPlan;
  launchAt: string;
  localization?: readonly string[];
  evidenceRefs: readonly string[];
}): SocialLaunchCampaign {
  const launchMs = Date.parse(input.launchAt);
  if (!Number.isFinite(launchMs)) {
    throw new Error('SOCIAL_LAUNCH_DATE_INVALID');
  }
  if (!input.evidenceRefs.length) {
    throw new Error('SOCIAL_LAUNCH_EVIDENCE_REQUIRED');
  }
  if (!input.plan.variants.length) {
    throw new Error('SOCIAL_LAUNCH_VARIANTS_REQUIRED');
  }

  const platformVariants = Object.freeze(
    input.plan.variants.map((variant) => variant.id),
  );
  const objectives = Object.freeze(unique(
    input.plan.variants.map((variant) => variant.objective),
  ) as SocialPortfolioObjective[]);
  const localization = Object.freeze(unique(input.localization ?? ['default']));
  const evidenceRefs = Object.freeze(unique(input.evidenceRefs));

  const waves = WAVE_SPEC.map((spec) => Object.freeze({
    id: `social-launch:${safe(input.plan.subjectId)}:${spec.phase}`,
    subjectId: input.plan.subjectId,
    phase: spec.phase,
    startsAt: new Date(launchMs + spec.startDay * DAY).toISOString(),
    endsAt: new Date(launchMs + spec.endDay * DAY).toISOString(),
    objectives,
    platformVariants,
    adjacentSurfaces: Object.freeze([...input.plan.adjacentSurfaces]),
    localization,
    jobs: spec.jobs,
    evidenceRefs,
    requiresPublicationApproval: true as const,
    requiresOutreachApproval: true as const,
    requiresSpendApproval: true as const,
    authority: 'PLANNING_ONLY' as const,
  }));

  return Object.freeze({
    subjectId: input.plan.subjectId,
    launchAt: new Date(launchMs).toISOString(),
    waves: Object.freeze(waves),
    doctrine: Object.freeze({
      simultaneousMultiChannel: true as const,
      progressiveDepth: true as const,
      qualityOverSprayAndPray: true as const,
      localizeWithoutIdentityDrift: true as const,
      postLaunchMomentumRequired: true as const,
    }),
    authority: 'PLANNING_ONLY' as const,
    externalActionAuthorized: false as const,
  });
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function safe(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]+/g, '-').slice(0, 120);
}
