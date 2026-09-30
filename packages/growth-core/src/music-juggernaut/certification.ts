import { decideJuggernautAutonomy, precheckRightsForScale } from './governance.js';
import { chooseJuggernautMode, decidePromotionSpend, detectCreativeOutlier, recommendVenueCapacity, validateExperimentPlan } from './intelligence.js';
import { canTransitionMusicCampaign } from './state.js';
import type { CityDemand, ContentExperiment, PerformanceObservation, PromotionBudget, RightsRecord } from './domain.js';

export interface MusicJuggernautCertification {
  passed: boolean;
  checks: readonly {name: string; passed: boolean}[];
  version: 'MUSIC-JUGGERNAUT.FINAL-v1';
}

export function certifyMusicJuggernautCore(): MusicJuggernautCertification {
  const observation: PerformanceObservation = {
    id: 'obs-1',
    experimentId: 'exp-1',
    exposures: 3000,
    views: 2400,
    shares: 120,
    saves: 180,
    comments: 90,
    profileVisits: 220,
    songActions: 300,
    directFanCaptures: 70,
    botRisk: 0.03,
    attributionConfidence: 0.95,
    observedAt: '2026-09-30T12:00:00.000Z',
    evidenceRefs: ['evidence:obs-1'],
  };
  const outlier = detectCreativeOutlier(observation, {
    medianViews: 800,
    medianSongActions: 60,
    medianDirectFanCaptures: 10,
    minimumExposures: 500,
  });
  const budget: PromotionBudget = {
    approvedMinor: 100000,
    spentMinor: 10000,
    experimentReserveMinor: 20000,
    breakoutReserveMinor: 40000,
    productionReserveMinor: 30000,
    currency: 'USD',
  };
  const rights: RightsRecord = {
    assetId: 'song-1',
    masterOwnershipKnown: true,
    publishingKnown: true,
    sampleStatus: 'none',
    thirdPartyUsageStatus: 'none',
    evidenceRefs: ['rights:1'],
  };
  const experiment: ContentExperiment = {
    id: 'exp-1',
    songId: 'song-1',
    hypothesis: 'Raw performance converts more direct fans than baseline.',
    contentFamily: 'location_performance',
    platform: 'short-form',
    spendMinor: 0,
    currency: 'USD',
    sampleTarget: 500,
    successSignal: 'direct fan lift',
    failureSignal: 'no meaningful downstream lift',
    status: 'planned',
    evidenceRefs: [],
  };
  const city: CityDemand = {
    city: 'Los Angeles',
    listeners: 5000,
    directFans: 80,
    showInterest: 65,
    priorAttendees: 30,
    repeatFans: 25,
    evidenceRefs: ['city:la'],
  };
  const spend = decidePromotionSpend({
    budget,
    mode: chooseJuggernautMode({outliers:[outlier]}),
    outlier,
    rights,
    requestedMinor: 10000,
    preAuthorizedLimitMinor: 15000,
  });
  const checks = [
    {name:'state-machine', passed:canTransitionMusicCampaign('EXPLORING','EARLY_SIGNAL') && !canTransitionMusicCampaign('INGESTED','SCALING')},
    {name:'outlier-detection', passed:outlier.status === 'validated'},
    {name:'attack-mode', passed:chooseJuggernautMode({outliers:[outlier]}) === 'ATTACK'},
    {name:'bounded-spend', passed:spend.action === 'CONTROLLED_SCALE' && spend.authorizedMinor === 10000 && !spend.requiresApproval},
    {name:'rights-gate', passed:precheckRightsForScale(rights).length === 0},
    {name:'autonomy-boundary', passed:!decideJuggernautAutonomy('contract_sign').allowedWithoutApproval && decideJuggernautAutonomy('analyze').allowedWithoutApproval},
    {name:'experiment-contract', passed:validateExperimentPlan(experiment).id === 'exp-1'},
    {name:'live-demand', passed:recommendVenueCapacity(city).recommendedCapacity >= 25},
  ] as const;
  return Object.freeze({
    passed: checks.every((check) => check.passed),
    checks: Object.freeze(checks.map((check) => Object.freeze({...check}))),
    version: 'MUSIC-JUGGERNAUT.FINAL-v1',
  });
}
