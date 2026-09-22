import { describe, expect, it } from 'vitest';
import {
  compileDirectorSocialTakeRequest,
  createDirectorSocialProductionBrief,
  expectedDirectorSocialGenerationJobId,
  issueDirectorSocialApprovedAssetReceipt,
} from './social-production-bridge.js';
import type { GeneratedAssetRecord } from './generated-asset-resolver.js';
import type { MediaReviewDecisionRecord } from './media-review-lifecycle.js';

describe('Director Social production bridge', () => {
  const brief = createDirectorSocialProductionBrief({
    id: 'brief-1',
    socialContentProjectId: 'social-project-1',
    socialAssetId: 'social-asset-1',
    directorProjectId: 'director-project-1',
    intent: 'Create a concise product demonstration with a clean opening hook.',
    mediaType: 'video',
    platform: 'tiktok',
    aspectRatio: '9:16',
    targetRuntimeSeconds: 30,
    referenceAssetIds: ['ref-1'],
    rightsEvidenceRefs: ['rights:owned:ref-1'],
    evidenceRefs: ['social:evidence:1'],
    createdAt: '2026-09-22T16:00:00.000Z',
  });

  it('compiles Social planning intent into a Director take without granting publish authority', () => {
    const take = compileDirectorSocialTakeRequest(brief, {
      storyboardBoardId: 'board-1',
      sceneId: 'scene-1',
      continuityLocks: ['character', 'lighting'],
    });

    expect(take.takeId).toBe('social:brief-1');
    expect(take.projectId).toBe('director-project-1');
    expect(take.storyboardBoardId).toBe('board-1');
    expect(take.prompt).toContain('target platform: tiktok');
    expect(brief.authority).toBe('PLANNING_ONLY');
    expect(brief.publicationAuthority).toBe('NONE');
  });

  it('requires rights evidence when Social references source assets', () => {
    expect(() => createDirectorSocialProductionBrief({
      id: 'brief-2',
      socialContentProjectId: 'social-project-1',
      socialAssetId: 'social-asset-1',
      directorProjectId: 'director-project-1',
      intent: 'Use this reference.',
      mediaType: 'image',
      referenceAssetIds: ['external-ref'],
      evidenceRefs: ['social:evidence:1'],
      createdAt: '2026-09-22T16:00:00.000Z',
    })).toThrow('DIRECTOR_SOCIAL_REFERENCE_RIGHTS_REQUIRED');
  });

  it('returns an asset to Social only after matching Director approval and provenance', () => {
    const generationJobId = expectedDirectorSocialGenerationJobId(brief);
    const provenance = {
      projectId: 'director-project-1',
      storyboardBoardIds: ['board-1'],
      storyboardVersion: 2,
      generationStageId: 'generation-stage',
      generationStageVersion: 3,
      generationJobId,
    };
    const asset: GeneratedAssetRecord = {
      id: 'director-asset-1',
      projectId: 'director-project-1',
      generationJobId,
      providerId: 'provider-1',
      mediaType: 'video',
      uri: 'https://media.example/social.mp4',
      sha256: 'abc123',
      createdAt: '2026-09-22T16:10:00.000Z',
      provenance,
    };
    const review: MediaReviewDecisionRecord = {
      id: 'review-1',
      projectId: 'director-project-1',
      runId: 'run-1',
      gateId: 'gate-1',
      generationStageId: 'generation-stage',
      generationStageVersion: 3,
      reviewStageId: 'review-stage',
      reviewStageVersion: 1,
      assetId: asset.id,
      generationJobId,
      decision: 'approved',
      evidenceIds: ['qc:video:1'],
      decidedBy: 'user-1',
      decidedAt: '2026-09-22T16:12:00.000Z',
      provenance,
    };

    const receipt = issueDirectorSocialApprovedAssetReceipt({
      receiptId: 'receipt-1',
      brief,
      asset,
      review,
    });

    expect(receipt.directorAssetId).toBe('director-asset-1');
    expect(receipt.authority).toBe('DIRECTOR_ASSET_APPROVED');
    expect(receipt.publicationAuthority).toBe('NONE');
  });

  it('rejects a Director asset that was not approved', () => {
    const generationJobId = expectedDirectorSocialGenerationJobId(brief);
    const provenance = {
      projectId: 'director-project-1',
      storyboardBoardIds: ['board-1'],
      storyboardVersion: 2,
      generationStageId: 'generation-stage',
      generationStageVersion: 3,
      generationJobId,
    };
    const asset: GeneratedAssetRecord = {
      id: 'director-asset-1',
      projectId: 'director-project-1',
      generationJobId,
      providerId: 'provider-1',
      mediaType: 'video',
      uri: 'https://media.example/social.mp4',
      createdAt: '2026-09-22T16:10:00.000Z',
      provenance,
    };
    const review: MediaReviewDecisionRecord = {
      id: 'review-1',
      projectId: 'director-project-1',
      runId: 'run-1',
      gateId: 'gate-1',
      generationStageId: 'generation-stage',
      generationStageVersion: 3,
      reviewStageId: 'review-stage',
      reviewStageVersion: 1,
      assetId: asset.id,
      generationJobId,
      decision: 'changes_requested',
      evidenceIds: ['qc:video:1'],
      decidedBy: 'user-1',
      decidedAt: '2026-09-22T16:12:00.000Z',
      provenance,
    };

    expect(() => issueDirectorSocialApprovedAssetReceipt({
      receiptId: 'receipt-1',
      brief,
      asset,
      review,
    })).toThrow('DIRECTOR_SOCIAL_ASSET_NOT_APPROVED');
  });
});
