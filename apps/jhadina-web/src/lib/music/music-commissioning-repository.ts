import {createClient} from '../supabase/server';

type Row=Record<string,unknown>;

export interface MusicCommissioningRepository {
  listPlatformAccounts(userId:string,projectId:string):Promise<Row[]>;
  listCatalogReleases(userId:string,projectId:string):Promise<Row[]>;
  listReceipts(userId:string,projectId:string):Promise<Row[]>;
  listRoyaltySnapshots(userId:string,projectId:string):Promise<Row[]>;
  listRoyaltyLines(userId:string,projectId:string):Promise<Row[]>;
  listVisualJobs(userId:string,projectId:string):Promise<Row[]>;
  upsertArtistProfile(input:{
    projectId:string;artistKey:string;canonicalName:string;ownerIdentity:string;canonicalHub:string;
    aliases:string[];evidenceRefs:string[];status:'canonical'|'discovered'|'review_required';
  }):Promise<Row>;
  upsertPlatformAccount(input:{
    projectId:string;platform:string;linkKind:string;profileUrl:string;handle?:string;
    verificationState:'declared'|'discovered'|'verified'|'rejected';confidence:number;
    provenanceSource:string;observedAt:string;evidenceRefs:string[];metadata?:Row;
  }):Promise<Row>;
  upsertCatalogRelease(input:{
    projectId:string;releaseKey:string;title:string;releaseType:'single'|'ep'|'album';releaseDate:string;
    trackCount:number;sourcePlatform:string;sourceUrl:string;verificationState:'discovered'|'verified'|'rejected';
    trackTitles:string[];evidenceRefs:string[];metadata?:Row;
  }):Promise<Row>;
  upsertReceipt(input:{
    projectId:string;stage:string;status:'complete'|'data_required'|'blocked'|'failed';
    evidenceRefs:string[];details:Row;
  }):Promise<Row>;
  upsertRoyaltySnapshot(input:{
    projectId:string;statementRef:string;source:string;currency:string;reportedTotalMinor:number;
    periodStart?:string;periodEnd?:string;observedAt:string;metadata?:Row;
  }):Promise<Row>;
  upsertRoyaltyLine(input:{
    projectId:string;snapshotId:string;lineKey:string;lineKind:'service'|'song';label:string;
    titleGroupKey?:string;amountMinor:number;artistName?:string;recordingRef?:string;evidenceRefs:string[];
  }):Promise<Row>;
  upsertVisualJob(input:{
    projectId:string;songId:string;experimentId?:string;planId:string;segmentId:string;
    deliverable:'lyric_video'|'teaser_pack'|'music_video'|'visualizer';directorProjectId:string;
    directorJobId?:string;parentDirectorJobId?:string;sourceAudioAssetId:string;vocalStemAssetId?:string;
    status:'planned'|'data_required'|'blocked'|'submitted'|'generating'|'preview_ready'|'complete'|'failed'|'cancelled';
    styleReferenceAssetIds:string[];artistReferenceAssetIds:string[];outputAssetIds:string[];
    evidenceRefs:string[];metadata?:Row;
  }):Promise<Row>;
}

export function createMusicCommissioningRepository():MusicCommissioningRepository {
  return {
    async listPlatformAccounts(userId,projectId){
      return listRows('jhadina_music_platform_accounts',userId,projectId,'updated_at');
    },
    async listCatalogReleases(userId,projectId){
      return listRows('jhadina_music_catalog_releases',userId,projectId,'release_date');
    },
    async listReceipts(userId,projectId){
      return listRows('jhadina_music_commission_receipts',userId,projectId,'updated_at');
    },
    async listRoyaltySnapshots(userId,projectId){
      return listRows('jhadina_music_royalty_snapshots',userId,projectId,'observed_at');
    },
    async listRoyaltyLines(userId,projectId){
      return listRows('jhadina_music_royalty_lines',userId,projectId,'created_at');
    },
    async listVisualJobs(userId,projectId){
      return listRows('jhadina_music_visual_jobs',userId,projectId,'updated_at');
    },
    async upsertArtistProfile(input){
      return rpcOne('jhadina_music_upsert_artist_profile',{
        p_project_id:input.projectId,
        p_artist_key:input.artistKey,
        p_canonical_name:input.canonicalName,
        p_owner_identity:input.ownerIdentity,
        p_canonical_hub:input.canonicalHub,
        p_aliases:input.aliases,
        p_evidence_refs:input.evidenceRefs,
        p_status:input.status,
      });
    },
    async upsertPlatformAccount(input){
      return rpcOne('jhadina_music_upsert_platform_account',{
        p_project_id:input.projectId,
        p_platform:input.platform,
        p_link_kind:input.linkKind,
        p_profile_url:input.profileUrl,
        p_handle:input.handle??null,
        p_verification_state:input.verificationState,
        p_confidence:input.confidence,
        p_provenance_source:input.provenanceSource,
        p_observed_at:input.observedAt,
        p_evidence_refs:input.evidenceRefs,
        p_metadata:input.metadata??{},
      });
    },
    async upsertCatalogRelease(input){
      return rpcOne('jhadina_music_upsert_catalog_release',{
        p_project_id:input.projectId,
        p_release_key:input.releaseKey,
        p_title:input.title,
        p_release_type:input.releaseType,
        p_release_date:input.releaseDate,
        p_track_count:input.trackCount,
        p_source_platform:input.sourcePlatform,
        p_source_url:input.sourceUrl,
        p_verification_state:input.verificationState,
        p_track_titles:input.trackTitles,
        p_evidence_refs:input.evidenceRefs,
        p_metadata:input.metadata??{},
      });
    },
    async upsertReceipt(input){
      return rpcOne('jhadina_music_upsert_commission_receipt',{
        p_project_id:input.projectId,
        p_stage:input.stage,
        p_status:input.status,
        p_evidence_refs:input.evidenceRefs,
        p_details:input.details,
      });
    },
    async upsertRoyaltySnapshot(input){
      return rpcOne('jhadina_music_upsert_royalty_snapshot',{
        p_project_id:input.projectId,
        p_statement_ref:input.statementRef,
        p_source:input.source,
        p_currency:input.currency,
        p_reported_total_minor:input.reportedTotalMinor,
        p_period_start:input.periodStart??null,
        p_period_end:input.periodEnd??null,
        p_observed_at:input.observedAt,
        p_metadata:input.metadata??{},
      });
    },
    async upsertRoyaltyLine(input){
      return rpcOne('jhadina_music_upsert_royalty_line',{
        p_project_id:input.projectId,
        p_snapshot_id:input.snapshotId,
        p_line_key:input.lineKey,
        p_line_kind:input.lineKind,
        p_label:input.label,
        p_title_group_key:input.titleGroupKey??null,
        p_amount_minor:input.amountMinor,
        p_artist_name:input.artistName??null,
        p_recording_ref:input.recordingRef??null,
        p_evidence_refs:input.evidenceRefs,
      });
    },
    async upsertVisualJob(input){
      return rpcOne('jhadina_music_upsert_visual_job',{
        p_project_id:input.projectId,
        p_song_id:input.songId,
        p_experiment_id:input.experimentId??null,
        p_plan_id:input.planId,
        p_segment_id:input.segmentId,
        p_deliverable:input.deliverable,
        p_director_project_id:input.directorProjectId,
        p_director_job_id:input.directorJobId??null,
        p_parent_director_job_id:input.parentDirectorJobId??null,
        p_source_audio_asset_id:input.sourceAudioAssetId,
        p_vocal_stem_asset_id:input.vocalStemAssetId??null,
        p_status:input.status,
        p_style_reference_asset_ids:input.styleReferenceAssetIds,
        p_artist_reference_asset_ids:input.artistReferenceAssetIds,
        p_output_asset_ids:input.outputAssetIds,
        p_evidence_refs:input.evidenceRefs,
        p_metadata:input.metadata??{},
      });
    },
  };
}

async function listRows(table:string,userId:string,projectId:string,orderColumn:string):Promise<Row[]> {
  const db=await createClient();
  const {data,error}=await db.from(table).select('*').eq('user_id',userId).eq('project_id',projectId).order(orderColumn,{ascending:false});
  if(error)throw new Error('MUSIC_COMMISSION_LIST_FAILED:'+table+':'+error.message);
  return (data??[]) as Row[];
}

async function rpcOne(name:string,args:Row):Promise<Row> {
  const db=await createClient();
  const {data,error}=await db.rpc(name,args).single();
  if(error||!data)throw new Error('MUSIC_COMMISSION_WRITE_FAILED:'+name+':'+(error?.message??'no row'));
  return data as Row;
}
