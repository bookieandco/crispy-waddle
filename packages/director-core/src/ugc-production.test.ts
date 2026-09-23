import { describe, expect, it } from 'vitest';
import {
  compileUgcGenerationBrief,
  evaluateUgcGenerationReadiness,
  nextUgcStage,
  type UgcProductionPlan,
} from './ugc-production.js';

function plan(): UgcProductionPlan {
  return {
    id: 'ugc:serum:1',
    projectId: 'ads',
    platform: 'tiktok',
    aspectRatio: '9:16',
    targetRuntimeSeconds: 30,
    product: {
      brandName: 'Nalvori',
      productName: 'Morning Serum',
      productBibleId: 'product:nalvori:serum',
      targetAudience: 'women in their 20s who want a simple morning routine',
      valuePropositionRefs: ['claim:light-feel', 'claim:simple-routine'],
      prohibitedClaimRefs: ['claim:treats-acne'],
      requiredClaimEvidenceIds: ['evidence:brand-copy'],
    },
    creatorCandidates: [{
      id: 'creator:1',
      creatorNature: 'synthetic',
      characterRef: 'character:ugc:1',
      audienceFitHypothesis: 'relatable early-career morning-routine creator',
      appearanceDirection: ['natural skin texture', 'not fashion-model polished'],
      wardrobeDirection: ['simple sleep tee'],
      rightsEvidenceIds: ['rights:synthetic-character'],
    }],
    locationCandidates: [{
      id: 'location:bathroom',
      description: 'small lived-in apartment bathroom in morning light',
      realismPurpose: 'looks like an ordinary phone-recorded morning routine',
      referenceAssetIds: ['asset:bathroom'],
      rightsEvidenceIds: ['rights:generated-location'],
    }],
    conceptOptions: [{
      id: 'concept:routine',
      title: 'Short morning routine',
      premise: 'creator casually walks through the few steps she actually uses',
      format: 'routine',
      productUse: 'apply a few drops, then moisturizer and sunscreen',
      claimRefs: ['claim:light-feel', 'claim:simple-routine'],
    }],
    scriptCandidates: [{
      id: 'script:1',
      durationSeconds: 30,
      spokenText: 'I keep my morning routine pretty short. I use a few drops, then moisturizer and sunscreen.',
      pronunciationNotes: { Nalvori: 'nal-VOR-ee' },
      performancePlan: {
        version: 1,
        sceneFunction: 'make the routine feel casual and useful',
        actors: [{ actorId: 'creator', startingState: 'just woke up', endingState: 'ready to get dressed' }],
        beats: [{
          id: 'apply',
          kind: 'action',
          actorId: 'creator',
          action: 'apply a few drops while continuing to talk',
          endState: 'serum spread naturally across cheeks',
        }],
      },
      realismPlan: {
        version: 1,
        goal: 'phone-shot naturalism',
        naturalismCues: ['skin-texture', 'breathing', 'nonuniform-motion'],
        physicalResponses: [],
      },
      claimRefs: ['claim:light-feel'],
      disclosureLine: 'Made with a virtual creator.',
    }],
    approvals: [
      { id: 'a1', stage: 'product-reference', selectedRef: 'product:nalvori:serum', approvedAt: '2026-09-22T00:00:00Z', approvedBy: 'owner' },
      { id: 'a2', stage: 'creator', selectedRef: 'creator:1', approvedAt: '2026-09-22T00:01:00Z', approvedBy: 'owner' },
      { id: 'a3', stage: 'location', selectedRef: 'location:bathroom', approvedAt: '2026-09-22T00:02:00Z', approvedBy: 'owner' },
      { id: 'a4', stage: 'concept', selectedRef: 'concept:routine', approvedAt: '2026-09-22T00:03:00Z', approvedBy: 'owner' },
      { id: 'a5', stage: 'script', selectedRef: 'script:1', approvedAt: '2026-09-22T00:04:00Z', approvedBy: 'owner' },
      { id: 'a6', stage: 'generation-brief', selectedRef: 'brief:1', approvedAt: '2026-09-22T00:05:00Z', approvedBy: 'owner' },
    ],
    currentStage: 'generation-brief',
    syntheticDisclosurePolicy: 'required',
    authority: 'DIRECTOR_UGC_PLAN',
  };
}

describe('UGC production', () => {
  it('blocks expensive generation until all cheap upstream choices are approved', () => {
    const incomplete = plan();
    incomplete.approvals = incomplete.approvals.filter((approval) => approval.stage !== 'script');
    const decision = evaluateUgcGenerationReadiness(incomplete);
    expect(decision.ready).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_UGC_APPROVAL_REQUIRED:script');
    expect(nextUgcStage(incomplete)).toBe('script');
  });

  it('compiles only an approved creator, location, concept and script', () => {
    const result = compileUgcGenerationBrief(plan());
    expect(result.creatorRef).toBe('character:ugc:1');
    expect(result.conceptId).toBe('concept:routine');
    expect(result.scriptId).toBe('script:1');
    expect(result.prompt).toContain('Made with a virtual creator.');
    expect(result.prompt).toContain('Do not introduce claims outside approved refs');
  });

  it('rejects prohibited or unapproved claims', () => {
    const invalid = plan();
    invalid.scriptCandidates = [{
      ...invalid.scriptCandidates[0]!,
      claimRefs: ['claim:treats-acne'],
    }];
    const decision = evaluateUgcGenerationReadiness(invalid);
    expect(decision.ready).toBe(false);
    expect(decision.reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_UGC_UNAPPROVED_CLAIM:claim:treats-acne',
      'DIRECTOR_UGC_PROHIBITED_CLAIM:claim:treats-acne',
    ]));
  });

  it('requires disclosure when the approved creator is synthetic and policy requires it', () => {
    const invalid = plan();
    invalid.scriptCandidates = [{
      ...invalid.scriptCandidates[0]!,
      disclosureLine: undefined,
    }];
    const decision = evaluateUgcGenerationReadiness(invalid);
    expect(decision.ready).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_UGC_SYNTHETIC_DISCLOSURE_REQUIRED');
  });
});
