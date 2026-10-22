import {
  buildMusicCreativePortfolio,
  type MusicContentFamily,
  type MusicCreativeBrief,
  type SongRecord,
} from '@jhadina/growth-core';
import {createContentProject, type ContentProject} from '@jhadina/social-core';
import {buildDirectorBriefFromSocial} from '../social/director-bridge';
import {buildMetaCampaignDraftFromApprovedCreative} from '../growth/meta-campaign-draft';
import type {DirectorSocialApprovedAssetReceipt} from '@jhadina/director-core';

type Row=Record<string,unknown>;
export const MUSIC_FIRST_TEST_FAMILIES=[
  'mini_music_video','raw_performance','meme',
] as const satisfies readonly MusicContentFamily[];
export type MusicTestFamily=typeof MUSIC_FIRST_TEST_FAMILIES[number];

export interface MusicCrossCoreVariant {
  family:MusicTestFamily;
  label:string;
  experimentKey:string;
  hypothesis:string;
  brief:MusicCreativeBrief;
  socialProject:ContentProject;
  directorBrief?:ReturnType<typeof buildDirectorBriefFromSocial>;
  caption:string;
  authority:'INTERNAL_DRAFT_ONLY';
}

export interface MusicCrossCorePlan {
  artistKey:'atwood-bookie';
  brand:'atwood-bookie';
  projectId:string;
  songId:string;
  songKey:string;
  title:string;
  variants:readonly MusicCrossCoreVariant[];
  directorProjectBound:boolean;
  rightsCleared:boolean;
  sectionsReady:boolean;
  blockers:readonly string[];
  socialPublishAuthority:'NONE';
  adSpendAuthority:'NONE';
  externalActionsStarted:false;
}

const titles:Record<MusicTestFamily,string>={
  mini_music_video:'Cinematic mini-story',
  raw_performance:'One-camera performance',
  meme:'Relatable comedy moment',
};
const hypotheses:Record<MusicTestFamily,string>={
  mini_music_video:'A self-contained story produces qualified song discovery.',
  raw_performance:'Unembellished performance drives authentic repeat listening.',
  meme:'A relatable joke drives qualified listeners, not just shallow views.',
};
const safe=(value:string)=>value.toLowerCase().replace(/[^a-z0-9_-]+/g,'-').slice(0,90);

/** General Music -> Social content project -> Director preview -> optional paid
 * draft compiler. It does not write data, start media generation or grant rights. */
export function buildMusicCrossCorePlan(input:{
  projectId:string;
  song:SongRecord;
  songKey:string;
  rights:readonly Row[];
  createdAt:string;
  /** Caller must verify this owner-scoped Director project before passing it. */
  directorProjectId?:string;
}):MusicCrossCorePlan{
  const {song,songKey,projectId}=input;
  if(!song.id.trim()||!song.title.trim()||!projectId.trim()||!songKey.trim())
    throw new Error('MUSIC_CROSS_CORE_CANONICAL_SONG_REQUIRED');
  if(!Number.isFinite(Date.parse(input.createdAt)))
    throw new Error('MUSIC_CROSS_CORE_TIMESTAMP_INVALID');
  if(input.directorProjectId !== undefined && !input.directorProjectId.trim())
    throw new Error('MUSIC_CROSS_CORE_DIRECTOR_PROJECT_INVALID');

  const rightsCleared=song.rightsState==='clear'&&input.rights.some(row=>
    row.asset_key===songKey&&row.master_ownership_known===true&&
    row.publishing_known===true&&
    ['cleared','none'].includes(String(row.sample_status))&&
    ['cleared','none'].includes(String(row.third_party_usage_status))&&
    Array.isArray(row.evidence_refs)&&row.evidence_refs.length>0);
  const sectionsReady=song.sections.some(s=>
    s.endMs>s.startMs&&s.startMs>=0&&s.functions.length>0);
  const evidence=[...new Set([
    ...song.evidenceRefs,
    'catalog-song-key:'+songKey,
    'artist:atwood-bookie',
  ])];
  const portfolio=buildMusicCreativePortfolio({
    song:{...song,evidenceRefs:evidence},
    mode:'SEARCH',maxBriefs:9,
  });
  const variants=MUSIC_FIRST_TEST_FAMILIES.map(family=>{
    const brief=portfolio.briefs.find(value=>value.family===family);
    if(!brief)throw new Error('MUSIC_CROSS_CORE_BRIEF_MISSING:'+family);
    const ident=safe(songKey)+':'+safe(song.id)+':'+family;
    const id='social:music:'+ident,assetId='social-asset:music:'+ident;
    const caption=song.title+' — '+titles[family]+'. Which moment is yours? #AtwoodBookie';
    const instruction=[
      'Atwood Bookie — '+song.title+' | '+titles[family]+'.',
      brief.capturePlan,
      brief.hook,
      'Use authorized audio, performance, footage and likenesses only.',
      'Do not invent lyrics, ownership, testimonials, views or conversions.',
      'Draft/preview only: no publishing or paid-ad authority.',
    ].join('\n');
    const socialProject=createContentProject({
      id,brand:'atwood-bookie',
      authorityPositionRef:'artist:atwood-bookie',
      pillarRef:'music:'+songKey,
      bigIdeaRef:'music:campaign:'+safe(songKey),
      primaryJob:'reach',origin:'ai_generated',
      evidenceRefs:[...evidence],createdAt:input.createdAt,
      anchor:{
        id:assetId,kind:'short_video',platform:'instagram',
        transformation:'original',text:instruction,
        mediaRefs:[],evidenceRefs:[...evidence],
      },
    });
    const directorBrief=input.directorProjectId
      ?buildDirectorBriefFromSocial(socialProject,assetId,{
        directorProjectId:input.directorProjectId,
        mediaType:'video',aspectRatio:'9:16',targetRuntimeSeconds:15,
        creativeIdentity:{
          experimentVariantId:'music:'+safe(songKey)+':'+family,
          mutationAxis:family,
          fixedDimensionRefs:{songKey,artist:'Atwood Bookie'},
        },
        createdAt:input.createdAt,
      }):undefined;
    return Object.freeze({
      family,label:titles[family],experimentKey:'music:search:'+ident,
      hypothesis:hypotheses[family],brief,socialProject,directorBrief,
      caption,authority:'INTERNAL_DRAFT_ONLY' as const,
    });
  });
  const blockers=[
    ...(!rightsCleared?['MUSIC_CROSS_CORE_DOCUMENTED_RIGHTS_REQUIRED']:[]),
    ...(!sectionsReady?['MUSIC_CROSS_CORE_REAL_SECTION_ANALYSIS_REQUIRED']:[]),
    ...(!input.directorProjectId?['MUSIC_CROSS_CORE_DIRECTOR_PROJECT_NOT_BOUND']:[]),
    'MUSIC_CROSS_CORE_DIRECTOR_ASSET_REVIEW_REQUIRED',
    'MUSIC_CROSS_CORE_SOCIAL_PROVIDER_AND_CHILD_APPROVAL_REQUIRED',
    'MUSIC_CROSS_CORE_REPLICATED_LEARNING_AND_PAID_APPROVAL_REQUIRED',
  ];
  return Object.freeze({
    artistKey:'atwood-bookie' as const,brand:'atwood-bookie' as const,
    projectId,songId:song.id,songKey,title:song.title,
    variants:Object.freeze(variants),
    directorProjectBound:Boolean(input.directorProjectId),
    rightsCleared,sectionsReady,
    blockers:Object.freeze(blockers),
    socialPublishAuthority:'NONE' as const,adSpendAuthority:'NONE' as const,
    externalActionsStarted:false as const,
  });
}

/** Candidate paid creative only, *not* a spend request or API call.
 * Canonical Growth Action Core must still request independent owner approval. */
export function buildMusicCrossCoreMetaDraft(input:{
  plan:MusicCrossCorePlan;
  family:MusicTestFamily;
  approvedReceipt:DirectorSocialApprovedAssetReceipt;
  sameSongValidatedReplications:number;
  rightsEvidenceRefs:readonly string[];
  providerAccountId:string;
  audienceIds:readonly string[];
  dailyBudgetMinor:number;
  lifetimeBudgetMinor:number;
}):ReturnType<typeof buildMetaCampaignDraftFromApprovedCreative>{
  const {plan,approvedReceipt}=input;
  const variant=plan.variants.find(item=>item.family===input.family);
  if(!variant)throw new Error('MUSIC_CROSS_CORE_VARIANT_UNKNOWN');
  if(!plan.directorProjectBound||!variant.directorBrief)
    throw new Error('MUSIC_CROSS_CORE_DIRECTOR_PROJECT_NOT_BOUND');
  if(!plan.rightsCleared||!input.rightsEvidenceRefs.length)
    throw new Error('MUSIC_CROSS_CORE_RIGHTS_NOT_CLEARED');
  if(!Number.isSafeInteger(input.sameSongValidatedReplications)||
    input.sameSongValidatedReplications<2)
    throw new Error('MUSIC_CROSS_CORE_REPLICATION_REQUIRED');
  if(approvedReceipt.socialContentProjectId!==variant.socialProject.id||
    approvedReceipt.socialAssetId!==variant.socialProject.assets[0]?.id||
    approvedReceipt.briefId!==variant.directorBrief.id||
    approvedReceipt.directorProjectId!==variant.directorBrief.directorProjectId)
    throw new Error('MUSIC_CROSS_CORE_APPROVAL_LINEAGE_MISMATCH');
  if(!Number.isSafeInteger(input.dailyBudgetMinor)||input.dailyBudgetMinor<=0||
    !Number.isSafeInteger(input.lifetimeBudgetMinor)||
    input.lifetimeBudgetMinor<input.dailyBudgetMinor)
    throw new Error('MUSIC_CROSS_CORE_BUDGET_INVALID');
  return buildMetaCampaignDraftFromApprovedCreative({
    brandId:'brand:atwood-bookie',
    name:plan.title+' — '+variant.label,
    objective:'traffic',providerAccountId:input.providerAccountId,
    audienceIds:input.audienceIds,approvedCreativeReceipts:[approvedReceipt],
    currency:'USD',dailyBudgetMinor:input.dailyBudgetMinor,
    lifetimeBudgetMinor:input.lifetimeBudgetMinor,
    idempotencyKey:'music:'+safe(plan.songKey)+':ad:'+input.family+':'+approvedReceipt.id,
  });
}
