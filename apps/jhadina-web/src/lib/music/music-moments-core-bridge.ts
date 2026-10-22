import {
  buildMusicCreativePortfolio,
  type MusicCreativeBrief,
  type SongRecord,
} from '@jhadina/growth-core';
import {createContentProject,type ContentProject} from '@jhadina/social-core';
import {buildDirectorBriefFromSocial} from '../social/director-bridge';
import {
  buildMetaCampaignDraftFromApprovedCreative,
  type MetaCampaignDraftInput,
} from '../growth/meta-campaign-draft';
import type {DirectorSocialApprovedAssetReceipt} from '@jhadina/director-core';

type Row=Record<string,unknown>;
export const MOMENTS_SONG_KEY='catalog:moments' as const;
export const MOMENTS_BRAND='atwood-bookie' as const;
export const MOMENTS_VARIANTS=['mini_music_video','raw_performance','meme'] as const;
export type MomentsVariantKey=typeof MOMENTS_VARIANTS[number];

export interface MomentsCampaignVariant {
  key:MomentsVariantKey;
  label:string;
  experimentKey:string;
  hypothesis:string;
  brief:MusicCreativeBrief;
  socialProject:ContentProject;
  directorBrief?:ReturnType<typeof buildDirectorBriefFromSocial>;
  caption:string;
  evidenceRefs:readonly string[];
  authority:'INTERNAL_DRAFT_ONLY';
}
export interface MomentsCampaignPlan{
  artistKey:'atwood-bookie';
  songKey:'catalog:moments';
  songId:string;
  title:string;
  projectId:string;
  variants:readonly MomentsCampaignVariant[];
  blockers:readonly string[];
  directorProjectBound:boolean;
  socialPublishAuthority:'NONE';
  adSpendAuthority:'NONE';
  externalActionsStarted:false;
}

/**
 * Reuse canonical Music, Social, Director and Meta draft contracts for an
 * actual owner-selected catalog song. Produces no media, campaign, provider
 * write, Post, OAuth request, money movement or simulated rights certificate.
 */
export function buildMomentsCampaignPlan(input:{
  projectId:string; song:SongRecord; songKey:string;
  rights:readonly Row[]; directorProjectId?:string;
  observedAt:string;
}):MomentsCampaignPlan{
  if(!input.projectId.trim()||input.songKey!==MOMENTS_SONG_KEY ||
    input.song.title.trim().toLowerCase()!=='moments'||!input.song.id.trim()){
    throw new Error('MOMENTS_CANONICAL_SONG_REQUIRED');
  }
  if(!Number.isFinite(Date.parse(input.observedAt)))throw new Error('MOMENTS_TIMESTAMP_INVALID');
  const documentedRights=input.rights.some(row=>
    row.asset_key===MOMENTS_SONG_KEY &&
    row.master_ownership_known===true && row.publishing_known===true &&
    ['cleared','none'].includes(String(row.sample_status)) &&
    ['cleared','none'].includes(String(row.third_party_usage_status)) &&
    Array.isArray(row.evidence_refs) && row.evidence_refs.length>0);
  const sectionsReady=input.song.sections.length>0;
  const evidenceRefs=Object.freeze([
    ...new Set([...input.song.evidenceRefs,'owner-selected:atwood-bookie:moments',
      'catalog-song-key:'+MOMENTS_SONG_KEY]),
  ]);
  const portfolio=buildMusicCreativePortfolio({
    song:{...input.song,evidenceRefs},
    mode:'SEARCH',maxBriefs:9,
  });
  const captions:Record<MomentsVariantKey,string>={
    mini_music_video:'Everybody has a moment. Which one changed yours? 🎬 #AtwoodBookie #Moments',
    raw_performance:'No effects, no shortcuts. Just the performance. 🎤 #AtwoodBookie #Moments',
    meme:'When a little moment turns into the whole story. 😭 #AtwoodBookie #Moments',
  };
  const labels:Record<MomentsVariantKey,string>={
    mini_music_video:'Cinematic mini-story',
    raw_performance:'One-camera performance',
    meme:'Relatable comedy moment',
  };
  const hypothesis:Record<MomentsVariantKey,string>={
    mini_music_video:'A simple narrative hook earns qualified song discovery.',
    raw_performance:'A raw performance creates authentic repeat listening interest.',
    meme:'A relatable joke attracts qualified listeners rather than low-intent views.',
  };
  const variants=MOMENTS_VARIANTS.map(key=>{
    const brief=portfolio.briefs.find(item=>item.family===key);
    if(!brief)throw new Error('MOMENTS_MUSIC_BRIEF_MISSING:'+key);
    const id='social:music:moments:'+input.song.id+':'+key;
    const assetId='social-asset:music:moments:'+input.song.id+':'+key;
    const caption=captions[key];
    const creativeInstruction=[
      labels[key]+'.',
      brief.capturePlan,
      brief.hook,
      'Song: Atwood Bookie — Moments.',
      'Use only artist-authorized source audio, likenesses, and footage.',
      'Do not fabricate lyrics, quotes, production rights, audience reactions, or performance data.',
      'Internal draft: no public posting or paid campaign authority.',
    ].join('\n');
    const socialProject=createContentProject({
      id,brand:MOMENTS_BRAND,
      authorityPositionRef:'artist:atwood-bookie',
      pillarRef:'music:catalog:moments',
      bigIdeaRef:'music:everybody-has-a-moment',
      primaryJob:'reach',origin:'ai_generated',
      evidenceRefs:[...evidenceRefs],
      createdAt:input.observedAt,
      anchor:{
        id:assetId,kind:'short_video',platform:'instagram',
        transformation:'original',text:creativeInstruction,mediaRefs:[],
        evidenceRefs:[...evidenceRefs],
      },
    });
    // A real Director project must be provided after owner-scoped verification.
    // Never manufacture an id as a claim of an existing production project.
    const directorBrief=input.directorProjectId
      ?buildDirectorBriefFromSocial(socialProject,assetId,{
        directorProjectId:input.directorProjectId,mediaType:'video',
        aspectRatio:'9:16',targetRuntimeSeconds:15,
        creativeIdentity:{experimentVariantId:'music:moments:'+key,mutationAxis:key,
          fixedDimensionRefs:{songKey:MOMENTS_SONG_KEY,artist:'Atwood Bookie'}},
        createdAt:input.observedAt,
      }):undefined;
    return Object.freeze({
      key,label:labels[key],experimentKey:'music:moments:search:'+key,
      hypothesis:hypothesis[key],brief,socialProject,directorBrief,caption,
      evidenceRefs,authority:'INTERNAL_DRAFT_ONLY' as const,
    });
  });
  const blockers=[
    ...(documentedRights&&input.song.rightsState==='clear'?[]:['MOMENTS_MASTER_PUBLISHING_AND_USAGE_RIGHTS_REQUIRED']),
    ...(sectionsReady?[]:['MOMENTS_REAL_AUDIO_SECTION_ANALYSIS_REQUIRED']),
    ...(input.directorProjectId?[]:['MOMENTS_DIRECTOR_PROJECT_NOT_BOUND']),
    'MOMENTS_APPROVED_DIRECTOR_MEDIA_AND_SOCIAL_CHILD_APPROVAL_REQUIRED',
    'MOMENTS_ATTRIBUTED_OUTLIER_AND_SEPARATE_PAID_APPROVAL_REQUIRED',
  ];
  return Object.freeze({
    artistKey:MOMENTS_BRAND,songKey:MOMENTS_SONG_KEY,
    songId:input.song.id,title:input.song.title,projectId:input.projectId,
    variants:Object.freeze(variants),
    blockers:Object.freeze(blockers),
    directorProjectBound:Boolean(input.directorProjectId),
    socialPublishAuthority:'NONE' as const,
    adSpendAuthority:'NONE' as const,
    externalActionsStarted:false as const,
  });
}

/** Paid ad *input* only, not an ad order. Uses the canonical Meta/Director
 * contract and refuses unrelated approvals or a provisional experiment. */
export function buildMomentsMetaDraft(input:{
  plan:MomentsCampaignPlan;
  variant:MomentsVariantKey;
  approvedReceipt:DirectorSocialApprovedAssetReceipt;
  sameSongValidatedReplications:number;
  rightsEvidenceRefs:readonly string[];
  accountId:string;audienceIds:readonly string[];
  dailyBudgetMinor:number;lifetimeBudgetMinor:number;
}):ReturnType<typeof buildMetaCampaignDraftFromApprovedCreative>{
  const selected=input.plan.variants.find(v=>v.key===input.variant);
  if(!selected)throw new Error('MOMENTS_VARIANT_UNKNOWN');
  if(!input.plan.directorProjectBound||!selected.directorBrief)throw new Error('MOMENTS_DIRECTOR_PROJECT_NOT_BOUND');
  if(input.sameSongValidatedReplications<2 ||
    !Number.isSafeInteger(input.sameSongValidatedReplications))
    throw new Error('MOMENTS_REPLICATED_SAME_SONG_LEARNING_REQUIRED');
  if(!input.rightsEvidenceRefs.length)throw new Error('MOMENTS_RIGHTS_EVIDENCE_REQUIRED');
  if(input.approvedReceipt.socialContentProjectId!==selected.socialProject.id||
    input.approvedReceipt.socialAssetId!==selected.socialProject.assets[0]?.id||
    input.approvedReceipt.briefId!==selected.directorBrief.id||
    input.approvedReceipt.directorProjectId!==selected.directorBrief.directorProjectId)
    throw new Error('MOMENTS_DIRECTOR_RECEIPT_VARIANT_MISMATCH');
  if(!Number.isSafeInteger(input.dailyBudgetMinor)||input.dailyBudgetMinor<=0||
    !Number.isSafeInteger(input.lifetimeBudgetMinor)||input.lifetimeBudgetMinor<input.dailyBudgetMinor)
    throw new Error('MOMENTS_AD_BUDGET_INVALID');
  const metaInput:MetaCampaignDraftInput={
    brandId:'brand:atwood-bookie',name:'Moments — '+selected.label,
    objective:'traffic',providerAccountId:input.accountId,
    audienceIds:input.audienceIds,approvedCreativeReceipts:[input.approvedReceipt],
    currency:'USD',dailyBudgetMinor:input.dailyBudgetMinor,
    lifetimeBudgetMinor:input.lifetimeBudgetMinor,
    idempotencyKey:'music:moments:ad:'+input.variant+':'+input.approvedReceipt.id,
  };
  return buildMetaCampaignDraftFromApprovedCreative(metaInput);
}
