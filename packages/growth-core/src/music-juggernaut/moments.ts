import {buildMusicCreativePortfolio,type MusicCreativeBrief,type MusicAdmittedCreativeLearning} from './content.js';
import {catalogSongSeeds,publicAtwoodBookieCatalogSeed} from './commissioning.js';
import type {RightsRecord,SongRecord,SongSection} from './domain.js';

/**
 * MOMENTS.01-.05 is a deliberately inert song-specific handoff.
 * Music plans; Director owns renders; Social owns publication and readback;
 * Growth owns paid execution and its approval boundary.
 */
export const MOMENTS_PILOT_VERSION='MUSIC-JUGGERNAUT.MOMENTS.01-05-v1' as const;
export const MOMENTS_RELEASE_KEY='boo-hefner-spring-2022' as const;
export type MomentsStageState='verified'|'blocked'|'unverified';
export type MomentsStageId='MUSIC-JUGGERNAUT.MOMENTS.01'|'MUSIC-JUGGERNAUT.MOMENTS.02'|
  'MUSIC-JUGGERNAUT.MOMENTS.03'|'MUSIC-JUGGERNAUT.MOMENTS.04'|'MUSIC-JUGGERNAUT.MOMENTS.05';

export interface MomentsSectionProof {
  songId:string; sectionId:string; audioSha256:string;
  analysisReceiptRef:string; measuredFromOwnedAudio:true;
}
export interface MomentsDirectorProof {
  songId:string; sectionId:string; briefId:string;
  jobId:string; assetSha256:string; previewRef:string;
  ownerApprovalRef:string; approvedAt:string;
}
export interface MomentsSocialReadback {
  songId:string; sectionId:string; briefId:string; directorAssetSha256:string;
  experimentKey:string; platform:string; accountId:string; proposalId:string;
  childApprovalRef:string; outboxId:string; providerPostId:string; providerReadbackRef:string;
}
export interface MomentsMeasuredOutcome {
  experimentKey:string; platform:string; accountId:string; providerPostId:string;
  exposures:number; songActions:number; attributionConfidence:number; botRisk:number;
  observationRef:string;
}
export interface MomentsPilotInput {
  /** Real owner-scoped song rows from the canonical Music project. */
  songs:readonly SongRecord[];
  /** Not inferred from a catalog listing or a song-level checkbox. */
  rights?:RightsRecord|null;
  sectionProofs?:readonly MomentsSectionProof[]|null;
  directorProof?:MomentsDirectorProof|null;
  socialReadbacks?:readonly MomentsSocialReadback[]|null;
  measuredOutcomes?:readonly MomentsMeasuredOutcome[]|null;
}
export interface MomentsPilotStage {
  id:MomentsStageId; state:MomentsStageState; title:string;
  blockers:readonly string[];
}
export interface MomentsPilot {
  version:typeof MOMENTS_PILOT_VERSION;
  catalog:{title:'Moments';release:'Boo Hefner Spring 2022';releaseDate:'2022-04-16';sourceUrl:string};
  songId:string|null; sectionId:string|null; sectionRangeMs:{start:number;end:number}|null;
  directorBriefs:readonly MusicCreativeBrief[];
  socialDraft:{experimentKey:string;briefId:string;requiresConnectedAccount:true;
    requiresApprovedDirectorAsset:true;requiresIndependentChildApproval:true;
    authority:'PROPOSAL_ONLY'}|null;
  growthAdsDraft:{experimentKey:string;spendMinor:0;requiresGrowthApproval:true;
    requiresBudgetAndRightsVerification:true;authority:'PROPOSAL_ONLY'}|null;
  validatedLearning:MusicAdmittedCreativeLearning|null;
  stages:readonly MomentsPilotStage[];
  pilotEvidenceMatched:boolean;
  /** Provider, owner device and canonical approval readback are separately certified. */
  livePilotVerified:false;
  externalActionsStarted:false;
}

function proofText(value:unknown):boolean{return typeof value==='string'&&value.trim().length>0;}
function sha256(value:string):boolean{return /^[a-f0-9]{64}$/i.test(value);}
function stage(id:MomentsStageId,title:string,ok:boolean|null,blockers:string[]):MomentsPilotStage{
  return {id,title,state:ok===null?'unverified':ok?'verified':'blocked',blockers:ok?[]:blockers};
}
function exactMomentsSong(songs:readonly SongRecord[]):SongRecord|null{
  const found=songs.filter(song=>song.title.trim().toLowerCase()==='moments');
  return found.length===1?found[0]!:null;
}
function sectionValid(section:SongSection,song:SongRecord,proof:MomentsSectionProof):boolean{
  return proof.songId===song.id&&proof.sectionId===section.id&&
    proof.measuredFromOwnedAudio===true&&sha256(proof.audioSha256)&&
    proofText(proof.analysisReceiptRef)&&section.songId===song.id&&
    Number.isFinite(section.startMs)&&Number.isFinite(section.endMs)&&
    section.startMs>=0&&section.endMs>section.startMs&&
    section.functions.length>0;
}
function rightsValid(rights:RightsRecord|null|undefined,song:SongRecord):boolean{
  return song.rightsState==='clear'&&rights?.assetId===song.id&&
    rights.masterOwnershipKnown===true&&rights.publishingKnown===true&&
    (rights.sampleStatus==='none'||rights.sampleStatus==='cleared')&&
    (rights.thirdPartyUsageStatus==='none'||rights.thirdPartyUsageStatus==='cleared')&&
    rights.evidenceRefs.some(proofText);
}
function directorValid(asset:MomentsDirectorProof|null|undefined,song:SongRecord,
  section:SongSection,briefs:readonly MusicCreativeBrief[]):boolean{
  return Boolean(asset&&asset.songId===song.id&&asset.sectionId===section.id&&
    briefs.some(brief=>brief.id===asset.briefId&&brief.songId===song.id&&brief.sectionId===section.id)&&
    proofText(asset.jobId)&&sha256(asset.assetSha256)&&proofText(asset.previewRef)&&
    proofText(asset.ownerApprovalRef)&&proofText(asset.approvedAt)&&
    Number.isFinite(Date.parse(asset.approvedAt)));
}
function verifiedReadback(post:MomentsSocialReadback,asset:MomentsDirectorProof,
  song:SongRecord,section:SongSection):boolean{
  return post.songId===song.id&&post.sectionId===section.id&&
    post.briefId===asset.briefId&&post.directorAssetSha256===asset.assetSha256&&
    proofText(post.experimentKey)&&post.platform!=='cross-platform-staging'&&
    proofText(post.platform)&&proofText(post.accountId)&&proofText(post.proposalId)&&
    proofText(post.childApprovalRef)&&proofText(post.outboxId)&&
    proofText(post.providerPostId)&&proofText(post.providerReadbackRef);
}
function qualifyLearning(posts:readonly MomentsSocialReadback[],
  outcomes:readonly MomentsMeasuredOutcome[],song:SongRecord,
  brief:MusicCreativeBrief):MusicAdmittedCreativeLearning|null{
  const byPost=new Map(posts.map(post=>[post.providerPostId,post]));
  const qualified=outcomes.filter(outcome=>{
    const post=byPost.get(outcome.providerPostId);
    return post&&outcome.experimentKey===post.experimentKey&&
      outcome.platform===post.platform&&outcome.accountId===post.accountId&&
      proofText(outcome.observationRef)&&Number.isFinite(outcome.exposures)&&
      outcome.exposures>=100&&Number.isFinite(outcome.songActions)&&outcome.songActions>0&&
      Number.isFinite(outcome.attributionConfidence)&&outcome.attributionConfidence>=0.75&&
      Number.isFinite(outcome.botRisk)&&outcome.botRisk>=0&&outcome.botRisk<=0.25;
  });
  const grouped=new Map<string,MomentsMeasuredOutcome[]>();
  for(const outcome of qualified){
    const rows=grouped.get(outcome.experimentKey)??[];
    rows.push(outcome);grouped.set(outcome.experimentKey,rows);
  }
  for(const [experimentKey,rows] of grouped){
    if(new Set(rows.map(row=>row.providerPostId)).size<2)continue;
    const refs=[...new Set(rows.map(row=>row.observationRef))];
    return {songId:song.id,experimentId:experimentKey,family:brief.family,
      confidence:Math.min(...rows.map(row=>row.attributionConfidence)),
      evidenceRefs:refs};
  }
  return null;
}

export function buildMomentsPilot(input:MomentsPilotInput):MomentsPilot{
  const release=publicAtwoodBookieCatalogSeed().find(row=>row.releaseKey===MOMENTS_RELEASE_KEY);
  const seed=catalogSongSeeds().find(row=>row.title==='Moments'&&row.releaseKey===MOMENTS_RELEASE_KEY);
  if(!release||!seed)throw new Error('MOMENTS_PUBLIC_CATALOG_EVIDENCE_MISSING');
  const song=exactMomentsSong(input.songs);
  const eligibleRights=Boolean(song&&rightsValid(input.rights,song));
  const section=(song&&eligibleRights? song.sections.find(candidate=>
    (input.sectionProofs??[]).some(proof=>sectionValid(candidate,song,proof))):null)??null;
  // Concepts may be drafted without audio, but they cannot claim a timed extraction.
  // Match the canonical cross-core Music test families; this is a proof gate,
  // not a competing Director/Social creative factory.
  const portfolio=song?buildMusicCreativePortfolio({song:section?{...song,sections:[section]}:song,mode:'SEARCH',maxBriefs:9}).briefs:[];
  const concepts=(['mini_music_video','raw_performance','meme'] as const)
    .flatMap(family=>portfolio.filter(brief=>brief.family===family).slice(0,1));
  const briefs=section?concepts.filter(brief=>brief.sectionId===section.id):[];
  const validAsset=Boolean(song&&section&&directorValid(input.directorProof,song,section,briefs));
  const posts=validAsset&&song&&section&&input.directorProof
    ?(input.socialReadbacks??[]).filter(post=>verifiedReadback(post,input.directorProof!,song,section)&&post.experimentKey==='moments:'+song.id+':'+section.id+':search'):[];
  const brief=validAsset&&input.directorProof?briefs.find(row=>row.id===input.directorProof!.briefId):undefined;
  const learning=brief&&song&&input.directorProof
    ?qualifyLearning(posts,input.measuredOutcomes??[],song,brief):null;
  const experimentKey= song&&section?'moments:'+song.id+':'+section.id+':search':null;
  const socialDraft=validAsset&&input.directorProof&&experimentKey?{
    experimentKey,briefId:input.directorProof.briefId,
    requiresConnectedAccount:true as const,requiresApprovedDirectorAsset:true as const,
    requiresIndependentChildApproval:true as const,authority:'PROPOSAL_ONLY' as const,
  }:null;
  const growthAdsDraft=experimentKey?{
    experimentKey,spendMinor:0 as const,requiresGrowthApproval:true as const,
    requiresBudgetAndRightsVerification:true as const,authority:'PROPOSAL_ONLY' as const,
  }:null;
  const stages:MomentsPilotStage[]=[
    stage('MUSIC-JUGGERNAUT.MOMENTS.01','Canonical song and release',Boolean(song),
      ['OWNER_PROJECT_MOMENTS_RECORD_NOT_UNIQUELY_FOUND']),
    stage('MUSIC-JUGGERNAUT.MOMENTS.02','Measured sections and verified rights',
      Boolean(section),['MOMENTS_RIGHTS_OR_OWNED_AUDIO_SECTION_EVIDENCE_REQUIRED']),
    stage('MUSIC-JUGGERNAUT.MOMENTS.03','Director render and independent owner approval',
      validAsset,['MOMENTS_APPROVED_RENDER_SHA_AND_PREVIEW_REQUIRED']),
    stage('MUSIC-JUGGERNAUT.MOMENTS.04','Social provider delivery and Growth Ads boundary',
      input.socialReadbacks===null||input.socialReadbacks===undefined?null:posts.length>0,
      ['MOMENTS_CONNECTED_ACCOUNT_CHILD_APPROVAL_OUTBOX_READBACK_REQUIRED']),
    stage('MUSIC-JUGGERNAUT.MOMENTS.05','Qualified replicated Music learning',
      input.measuredOutcomes===null||input.measuredOutcomes===undefined?null:Boolean(learning),
      ['MOMENTS_TWO_PROVIDER_MATCHED_QUALITY_OUTCOMES_REQUIRED']),
  ];
  return {
    version:MOMENTS_PILOT_VERSION,
    catalog:{title:'Moments',release:'Boo Hefner Spring 2022',releaseDate:'2022-04-16',sourceUrl:seed.sourceUrl},
    songId:song?.id??null,sectionId:section?.id??null,
    sectionRangeMs:section?{start:section.startMs,end:section.endMs}:null,
    directorBriefs:concepts,socialDraft,growthAdsDraft,validatedLearning:learning,
    stages,pilotEvidenceMatched:stages.every(row=>row.state==='verified'),
    livePilotVerified:false,
    externalActionsStarted:false,
  };
}
