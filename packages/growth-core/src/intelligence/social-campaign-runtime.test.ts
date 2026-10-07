import { describe, expect, it } from 'vitest';
import {
  compileSocialJuggernautPlan,
  type SocialPortfolioSubject,
} from './social-juggernaut.js';
import {
  createSocialCampaignRun,
  resumeSocialCampaign,
  updateSocialCampaignCheckpoint,
  type SocialCampaignRun,
  type SocialCampaignStage,
} from './social-campaign-runtime.js';

const subject: SocialPortfolioSubject = {
  id: 'subject:campaign-runtime',
  kind: 'product',
  brandId: 'brand:pupsonstuff',
  label: 'PupsonStuff campaign',
  audienceSignals: ['pet owner', 'gift buyer'],
  objectives: ['discovery', 'product_sale', 'direct_capture'],
  preferredSurfaces: ['social:instagram', 'social:tiktok', 'social:pinterest'],
  evidenceRefs: ['product:truth'],
  scores: {
    businessValue: 90,
    evidenceQuality: 90,
    contentReadiness: 85,
    learningValue: 80,
    urgency: 75,
  },
};

const T = {
  t0: '2026-10-07T19:00:00.000Z',
  t1: '2026-10-07T19:01:00.000Z',
  t2: '2026-10-07T19:02:00.000Z',
  t3: '2026-10-07T19:03:00.000Z',
  t4: '2026-10-07T19:04:00.000Z',
  t5: '2026-10-07T19:05:00.000Z',
};

function run(): SocialCampaignRun {
  return createSocialCampaignRun({
    id: 'social-campaign:1',
    plan: compileSocialJuggernautPlan(subject),
    destinationSetRefs: [
      'social-set:pupsonstuff:organic',
      'social-set:pupsonstuff:pinterest',
    ],
    createdAt: T.t0,
  });
}

function complete(
  current: SocialCampaignRun,
  stage: SocialCampaignStage,
  at: string,
  extras: {
    approvalRef?: string;
    externalReceiptRefs?: string[];
  } = {},
): SocialCampaignRun {
  const started = updateSocialCampaignCheckpoint(current, {
    stage,
    status: 'running',
    observedAt: at,
    evidenceRefs: [`evidence:${stage}:start`],
  });
  return updateSocialCampaignCheckpoint(started, {
    stage,
    status: 'completed',
    observedAt: at,
    evidenceRefs: [`evidence:${stage}:complete`],
    approvalRef: extras.approvalRef,
    externalReceiptRefs: extras.externalReceiptRefs,
  });
}

function throughApproval(): SocialCampaignRun {
  let current = run();
  current = complete(current, 'research', T.t1);
  current = complete(current, 'strategy', T.t2);
  current = complete(current, 'render', T.t3);
  current = complete(current, 'review', T.t4);

  const approvalStarted = updateSocialCampaignCheckpoint(current, {
    stage: 'approval',
    status: 'running',
    observedAt: T.t5,
    evidenceRefs: ['approval:requested'],
  });
  return updateSocialCampaignCheckpoint(approvalStarted, {
    stage: 'approval',
    status: 'completed',
    observedAt: T.t5,
    evidenceRefs: ['approval:exact-payload'],
    approvalRef: 'approval-receipt:123',
  });
}

describe('Social Juggernaut campaign runtime', () => {
  it('creates a durable checkpointed run without granting publication authority', () => {
    const current = run();

    expect(current.checkpoints.map((item) => item.stage)).toEqual([
      'research',
      'strategy',
      'render',
      'review',
      'approval',
      'schedule',
      'publish',
      'reconcile',
      'measure',
      'learn',
    ]);
    expect(current.policy.resumeFromLastDurableCheckpoint).toBe(true);
    expect(current.policy.noBlindRetryAfterAmbiguousSideEffect).toBe(true);
    expect(current.publicationAuthority).toBe('NONE');
    expect(current.externalActionAuthorized).toBe(false);
  });

  it('resumes the first incomplete stage instead of restarting prior work', () => {
    let current = run();
    current = complete(current, 'research', T.t1);
    current = updateSocialCampaignCheckpoint(current, {
      stage: 'strategy',
      status: 'running',
      observedAt: T.t2,
      evidenceRefs: ['strategy:started'],
    });

    expect(resumeSocialCampaign(current)).toMatchObject({
      stage: 'strategy',
      action: 'RESUME',
    });
  });

  it('requires exact approval before schedule or publish execution can begin', () => {
    let current = run();
    current = complete(current, 'research', T.t1);
    current = complete(current, 'strategy', T.t2);
    current = complete(current, 'render', T.t3);
    current = complete(current, 'review', T.t4);

    expect(() => updateSocialCampaignCheckpoint(current, {
      stage: 'schedule',
      status: 'running',
      observedAt: T.t5,
      evidenceRefs: ['schedule:start'],
    })).toThrow(/PRIOR_STAGE_INCOMPLETE:approval/);
  });

  it('requires provider receipts before a publish can be claimed complete', () => {
    let current = throughApproval();
    current = complete(current, 'schedule', T.t5);

    current = updateSocialCampaignCheckpoint(current, {
      stage: 'publish',
      status: 'running',
      observedAt: T.t5,
      evidenceRefs: ['publish:accepted'],
    });

    expect(() => updateSocialCampaignCheckpoint(current, {
      stage: 'publish',
      status: 'completed',
      observedAt: T.t5,
      evidenceRefs: ['publish:claimed'],
    })).toThrow(/PUBLISH_RECEIPT_REQUIRED/);
  });

  it('blocks blind retry after an ambiguous publish and routes to reconciliation', () => {
    let current = throughApproval();
    current = complete(current, 'schedule', T.t5);
    current = updateSocialCampaignCheckpoint(current, {
      stage: 'publish',
      status: 'running',
      observedAt: T.t5,
      evidenceRefs: ['publish:attempt'],
    });
    current = updateSocialCampaignCheckpoint(current, {
      stage: 'publish',
      status: 'ambiguous',
      observedAt: T.t5,
      evidenceRefs: ['publish:timeout'],
      error: 'provider timeout after request submission',
    });

    expect(resumeSocialCampaign(current)).toMatchObject({
      stage: 'reconcile',
      action: 'RECONCILE',
    });
    expect(() => updateSocialCampaignCheckpoint(current, {
      stage: 'publish',
      status: 'running',
      observedAt: T.t5,
      evidenceRefs: ['publish:retry'],
    })).toThrow(/AMBIGUOUS/);
  });

  it('advances to measurement after an ambiguous publish is reconciled', () => {
    let current = throughApproval();
    current = complete(current, 'schedule', T.t5);
    current = updateSocialCampaignCheckpoint(current, {
      stage: 'publish',
      status: 'running',
      observedAt: T.t5,
      evidenceRefs: ['publish:attempt'],
    });
    current = updateSocialCampaignCheckpoint(current, {
      stage: 'publish',
      status: 'ambiguous',
      observedAt: T.t5,
      evidenceRefs: ['publish:unknown'],
    });
    current = updateSocialCampaignCheckpoint(current, {
      stage: 'reconcile',
      status: 'running',
      observedAt: T.t5,
      evidenceRefs: ['reconcile:provider-query'],
    });
    current = updateSocialCampaignCheckpoint(current, {
      stage: 'reconcile',
      status: 'completed',
      observedAt: T.t5,
      evidenceRefs: ['reconcile:confirmed-platform-state'],
      externalReceiptRefs: ['provider:post:abc'],
    });

    expect(resumeSocialCampaign(current)).toMatchObject({
      stage: 'measure',
      action: 'START',
    });
  });

  it('keeps completed checkpoints immutable', () => {
    let current = run();
    current = complete(current, 'research', T.t1);

    expect(() => updateSocialCampaignCheckpoint(current, {
      stage: 'research',
      status: 'running',
      observedAt: T.t2,
      evidenceRefs: ['research:restart'],
    })).toThrow(/COMPLETED_STAGE_IMMUTABLE/);
  });
});
