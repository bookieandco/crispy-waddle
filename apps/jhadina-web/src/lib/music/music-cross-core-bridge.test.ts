import {describe,expect,it} from 'vitest';
import type {SongRecord} from '@jhadina/growth-core';
import type {DirectorSocialApprovedAssetReceipt} from '@jhadina/director-core';
import {
  buildMusicCrossCorePlan,
  buildMusicCrossCoreMetaDraft,
  MUSIC_FIRST_TEST_FAMILIES,
} from './music-cross-core-bridge';
import {buildMomentsCampaignPlan} from './music-moments-core-bridge';

function song(title='Moments'):SongRecord {
  return {
    id:'song-uuid-001',title,status:'catalog',artistConviction:0.5,
    rightsState:'review_required',sections:[],evidenceRefs:['public-catalog:release:1'],
  };
}
const rights=[{
  asset_key:'catalog:moments',master_ownership_known:true,publishing_known:true,
  sample_status:'cleared',third_party_usage_status:'none',
  evidence_refs:['cleared-master-and-publishing:owner-reviewed'],
}];
const run=(input:Partial<Parameters<typeof buildMusicCrossCorePlan>[0]>={})=>
  buildMusicCrossCorePlan({
    projectId:'p',song:song(),songKey:'catalog:moments',
    rights:[],createdAt:'2026-10-21T18:00:00.000Z',...input,
  });
function approved(input:{socialId:string;assetId:string;briefId:string;directorId:string}):DirectorSocialApprovedAssetReceipt {
  return {
    id:'director-approval:1',briefId:input.briefId,
    socialContentProjectId:input.socialId,socialAssetId:input.assetId,
    directorProjectId:input.directorId,
    directorAssetId:'asset:approved:1',generationJobId:'generation:1',
    mediaType:'video',uri:'https://media.example/approved.mp4',
    reviewDecisionId:'media-review:1',reviewEvidenceIds:['qc:pass:1'],
    approvedAt:'2026-10-21T18:30:00.000Z',
    provenance:{
      projectId:input.directorId,storyboardBoardIds:['board:1'],storyboardVersion:1,
      generationStageId:'stage:1',generationStageVersion:1,generationJobId:'generation:1',
    },
    authority:'DIRECTOR_ASSET_APPROVED',publicationAuthority:'NONE',
  };
}

describe('Music cross-core handoff, all songs; Moments pilot',()=>{
  it('builds three distinct canonical Social projects with no permission to publish or spend',()=>{
    const plan=run();
    expect(plan.songKey).toBe('catalog:moments');
    expect(plan.variants.map(v=>v.family)).toEqual([...MUSIC_FIRST_TEST_FAMILIES]);
    expect(new Set(plan.variants.map(v=>v.socialProject.id)).size).toBe(3);
    expect(new Set(plan.variants.map(v=>v.experimentKey)).size).toBe(3);
    expect(plan.variants.every(v=>v.socialProject.brand==='atwood-bookie')).toBe(true);
    expect(plan.variants.every(v=>v.socialProject.assets[0]?.mediaRefs.length===0)).toBe(true);
    expect(plan.variants.every(v=>v.directorBrief===undefined)).toBe(true);
    expect(plan.rightsCleared).toBe(false);
    expect(plan.adSpendAuthority).toBe('NONE');
    expect(plan.socialPublishAuthority).toBe('NONE');
    expect(plan.externalActionsStarted).toBe(false);
    expect(run().variants.map(v=>v.socialProject.id)).toEqual(plan.variants.map(v=>v.socialProject.id));
  });

  it('builds real Director production briefs from canonical Social contracts only when project bound',()=>{
    const plan=run({directorProjectId:'director:owner-project'});
    for(const v of plan.variants){
      expect(v.directorBrief?.socialContentProjectId).toBe(v.socialProject.id);
      expect(v.directorBrief?.socialAssetId).toBe(v.socialProject.assets[0]?.id);
      expect(v.directorBrief?.directorProjectId).toBe('director:owner-project');
      expect(v.directorBrief?.publicationAuthority).toBe('NONE');
      expect(v.directorBrief?.targetRuntimeSeconds).toBe(15);
    }
  });

  it('works with another existing song without manufacturing a second database',()=>{
    const plan=run({song:song('Aladdin'),songKey:'catalog:aladdin'});
    expect(plan.title).toBe('Aladdin');
    expect(plan.variants.every(v=>v.socialProject.pillarRef==='music:catalog:aladdin')).toBe(true);
    expect(buildMomentsCampaignPlan({
      projectId:'p',song:song(),songKey:'catalog:moments',
      rights:[],observedAt:'2026-10-21T18:00:00.000Z',
    }).variants.map(v=>v.family)).toEqual([...MUSIC_FIRST_TEST_FAMILIES]);
    expect(()=>buildMomentsCampaignPlan({
      projectId:'p',song:song('Aladdin'),songKey:'catalog:aladdin',
      rights:[],observedAt:'2026-10-21T18:00:00.000Z',
    })).toThrow('MOMENTS_CANONICAL_SONG_REQUIRED');
  });

  it('never approves ads without both rights and replicated same-song learning',()=>{
    const pending=run({directorProjectId:'director:owner-project'});
    const variant=pending.variants[0]!;
    const receipt=approved({
      socialId:variant.socialProject.id,
      assetId:variant.socialProject.assets[0]!.id,
      briefId:variant.directorBrief!.id,directorId:'director:owner-project',
    });
    const base={
      plan:pending,family:variant.family,approvedReceipt:receipt,
      sameSongValidatedReplications:2,rightsEvidenceRefs:['master:verified'],
      providerAccountId:'meta:owner-verified',audienceIds:['audience:one'],
      dailyBudgetMinor:100,lifetimeBudgetMinor:300,
    };
    expect(()=>buildMusicCrossCoreMetaDraft(base)).toThrow('MUSIC_CROSS_CORE_RIGHTS_NOT_CLEARED');
    const cleared=run({
      directorProjectId:'director:owner-project',
      rights,song:{...song(),rightsState:'clear'},
    });
    expect(cleared.rightsCleared).toBe(true);
    expect(()=>buildMusicCrossCoreMetaDraft({...base,plan:cleared,sameSongValidatedReplications:1}))
      .toThrow('MUSIC_CROSS_CORE_REPLICATION_REQUIRED');
    expect(()=>buildMusicCrossCoreMetaDraft({
      ...base,plan:cleared,approvedReceipt:{...receipt,socialContentProjectId:'other:brand'},
    })).toThrow('MUSIC_CROSS_CORE_APPROVAL_LINEAGE_MISMATCH');
    const draft=buildMusicCrossCoreMetaDraft({...base,plan:cleared});
    expect(draft.channel).toBe('meta');
    expect(draft.provider).toBe('markifact');
    expect(draft.creativeIds).toEqual(['asset:approved:1']);
    expect(draft.dailyBudgetMinor).toBe(100);
    expect(draft.lifetimeBudgetMinor).toBe(300);
  });
});
