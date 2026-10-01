import { describe, expect, it } from 'vitest';
import {
  buildDealPrecheck,
  buildMusicJuggernautEvent,
  canTransitionMusicCampaign,
  certifyMusicJuggernautCore,
  chooseJuggernautMode,
  consolidateCreativeOutliers,
  decideJuggernautAutonomy,
  decidePromotionSpend,
  detectCreativeOutlier,
  openBreakoutWindow,
  recommendVenueCapacity,
  transitionMusicCampaign,
} from './index.js';
import type { PerformanceObservation, PromotionBudget, RightsRecord } from './index.js';

const observation: PerformanceObservation = {
  id: 'obs',
  experimentId: 'exp',
  exposures: 3000,
  views: 2100,
  shares: 100,
  saves: 140,
  comments: 60,
  profileVisits: 170,
  songActions: 260,
  directFanCaptures: 60,
  botRisk: 0.02,
  attributionConfidence: 0.95,
  observedAt: '2026-09-30T12:00:00.000Z',
  evidenceRefs: ['obs:1'],
};

describe('Music Juggernaut core', () => {
  it('enforces legal campaign transitions', () => {
    expect(canTransitionMusicCampaign('EXPLORING', 'EARLY_SIGNAL')).toBe(true);
    expect(canTransitionMusicCampaign('INGESTED', 'SCALING')).toBe(false);
    expect(() => transitionMusicCampaign('INGESTED', 'SCALING')).toThrow('MUSIC_JUGGERNAUT_ILLEGAL_STATE_TRANSITION');
  });

  it('detects relative outliers against artist baseline', () => {
    const outlier = detectCreativeOutlier(observation, {
      medianViews: 700,
      medianSongActions: 50,
      medianDirectFanCaptures: 8,
      minimumExposures: 500,
    });
    expect(outlier.status).toBe('validated');
    expect(outlier.replicationCount).toBe(1);
    expect(chooseJuggernautMode({outliers:[outlier]})).toBe('SEARCH');
    const replicated=consolidateCreativeOutliers([
      outlier,
      detectCreativeOutlier({...observation,id:'obs-2',evidenceRefs:['obs:2']}, {
        medianViews:700,medianSongActions:50,medianDirectFanCaptures:8,minimumExposures:500,
      }),
    ])[0]!;
    expect(replicated.replicationCount).toBe(2);
    expect(chooseJuggernautMode({outliers:[replicated]})).toBe('ATTACK');
  });

  it('holds scale when rights are blocked and never exceeds preauthorization', () => {
    const budget: PromotionBudget = {
      approvedMinor: 100000,
      spentMinor: 10000,
      experimentReserveMinor: 20000,
      breakoutReserveMinor: 40000,
      productionReserveMinor: 30000,
      currency: 'USD',
    };
    const clear: RightsRecord = {
      assetId: 'song',
      masterOwnershipKnown: true,
      publishingKnown: true,
      sampleStatus: 'none',
      thirdPartyUsageStatus: 'none',
      evidenceRefs: ['rights:clear'],
    };
    const outlier = detectCreativeOutlier(observation, {
      medianViews: 700,
      medianSongActions: 50,
      medianDirectFanCaptures: 8,
      minimumExposures: 500,
    });
    const replicatedOutlier=consolidateCreativeOutliers([
      outlier,
      detectCreativeOutlier({...observation,id:'obs-rep',evidenceRefs:['obs:rep']}, {
        medianViews:700,medianSongActions:50,medianDirectFanCaptures:8,minimumExposures:500,
      }),
    ])[0]!;
    const decision = decidePromotionSpend({
      budget,
      mode: 'ATTACK',
      outlier:replicatedOutlier,
      rights: clear,
      requestedMinor: 50000,
      preAuthorizedLimitMinor: 15000,
    });
    expect(decision.action).toBe('CONTROLLED_SCALE');
    expect(decision.authorizedMinor).toBe(15000);
    expect(decision.requiresApproval).toBe(true);

    const blocked: RightsRecord = {...clear, sampleStatus:'blocked', evidenceRefs:['rights:blocked']};
    expect(decidePromotionSpend({
      budget,
      mode:'ATTACK',
      outlier:replicatedOutlier,
      rights:blocked,
      requestedMinor:1000,
      preAuthorizedLimitMinor:15000,
    }).action).toBe('STOP');

    const unknown: RightsRecord = {
      ...clear,
      masterOwnershipKnown:false,
      publishingKnown:false,
      sampleStatus:'review_required',
      thirdPartyUsageStatus:'review_required',
      evidenceRefs:['rights:unknown'],
    };
    expect(decidePromotionSpend({
      budget,
      mode:'ATTACK',
      outlier:replicatedOutlier,
      rights:unknown,
      requestedMinor:1000,
      preAuthorizedLimitMinor:15000,
    }).authorizedMinor).toBe(0);
  });

  it('keeps consequential actions behind approval', () => {
    expect(decideJuggernautAutonomy('analyze').allowedWithoutApproval).toBe(true);
    expect(decideJuggernautAutonomy('public_publish').requiredCapability).toBe('public.publish');
    expect(decideJuggernautAutonomy('contract_sign').allowedWithoutApproval).toBe(false);
  });

  it('opens breakout windows only on strong evidence', () => {
    const window = openBreakoutWindow({
      songId:'song-1',
      openedAt:'2026-09-30T12:00:00.000Z',
      signals:[{id:'signal-1',songId:'song-1',trigger:'creative_outlier',strength:0.8,evidenceRefs:['signal:1']}],
    });
    expect(window.state).toBe('OPEN');
    expect(window.priorities.length).toBeGreaterThan(3);
  });

  it('sizes rooms from evidence instead of passive listener count', () => {
    const recommendation = recommendVenueCapacity({
      city:'Los Angeles',
      listeners:100000,
      directFans:40,
      showInterest:25,
      priorAttendees:10,
      repeatFans:8,
      evidenceRefs:['city:la'],
    });
    expect(recommendation.recommendedCapacity).toBeLessThan(500);
    expect(recommendation.authority).toBe('ANALYSIS_ONLY');
  });

  it('requires attorney review for deal prechecks', () => {
    const result = buildDealPrecheck({
      guaranteedCashMinor:2500000,
      optionalCashMinor:2500000,
      termMonths:120,
      revenueParticipation:['merch','live'],
      masterGrant:'exclusive',
      publishingGrant:undefined,
      recoupmentKnown:false,
      terminationKnown:false,
      reversionKnown:false,
      evidenceRefs:['deal:1'],
    });
    expect(result.requiresAttorneyReview).toBe(true);
    expect(result.blockers.length).toBeGreaterThan(2);
  });

  it('emits traceable juggernaut events', () => {
    const event = buildMusicJuggernautEvent({
      eventId:'e1',
      eventType:'music.outlier.detected',
      entityType:'song',
      entityId:'song-1',
      actor:'jhadina',
      source:'music-juggernaut',
      payload:{status:'validated'},
      occurredAt:'2026-09-30T12:00:00.000Z',
      correlationId:'c1',
      idempotencyKey:'k1',
    });
    expect(event.eventType).toBe('music.outlier.detected');
  });

  it('passes core certification', () => {
    expect(certifyMusicJuggernautCore().passed).toBe(true);
  });
});
