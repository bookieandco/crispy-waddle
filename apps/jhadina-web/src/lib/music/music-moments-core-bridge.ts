import type {SongRecord} from '@jhadina/growth-core';
import type {DirectorSocialApprovedAssetReceipt} from '@jhadina/director-core';
import {
  buildMusicCrossCorePlan,
  buildMusicCrossCoreMetaDraft,
  type MusicCrossCorePlan,
  type MusicTestFamily,
} from './music-cross-core-bridge';

type Row=Record<string,unknown>;
export const MOMENTS_SONG_KEY='catalog:moments' as const;
export const MOMENTS_VARIANTS=['mini_music_video','raw_performance','meme'] as const;
export type MomentsCampaignPlan=MusicCrossCorePlan;

/** Pilot on the canonical existing catalog row; no parallel Music subsystem. */
export function buildMomentsCampaignPlan(input:{
  projectId:string; song:SongRecord; songKey:string;
  rights:readonly Row[]; directorProjectId?:string; observedAt:string;
}):MomentsCampaignPlan{
  if(input.songKey!==MOMENTS_SONG_KEY||input.song.title.trim().toLowerCase()!=='moments')
    throw new Error('MOMENTS_CANONICAL_SONG_REQUIRED');
  return buildMusicCrossCorePlan({
    projectId:input.projectId,song:input.song,songKey:input.songKey,
    rights:input.rights,createdAt:input.observedAt,
    directorProjectId:input.directorProjectId,
  });
}

/** Even a valid ad draft must still pass canonical Action Core paid approval. */
export function buildMomentsMetaDraft(input:{
  plan:MomentsCampaignPlan; variant:MusicTestFamily;
  approvedReceipt:DirectorSocialApprovedAssetReceipt;
  sameSongValidatedReplications:number;
  rightsEvidenceRefs:readonly string[];
  accountId:string;audienceIds:readonly string[];
  dailyBudgetMinor:number;lifetimeBudgetMinor:number;
}){
  if(input.plan.songKey!==MOMENTS_SONG_KEY)throw new Error('MOMENTS_CANONICAL_SONG_REQUIRED');
  return buildMusicCrossCoreMetaDraft({
    plan:input.plan,family:input.variant,
    approvedReceipt:input.approvedReceipt,
    sameSongValidatedReplications:input.sameSongValidatedReplications,
    rightsEvidenceRefs:input.rightsEvidenceRefs,
    providerAccountId:input.accountId,audienceIds:input.audienceIds,
    dailyBudgetMinor:input.dailyBudgetMinor,
    lifetimeBudgetMinor:input.lifetimeBudgetMinor,
  });
}
