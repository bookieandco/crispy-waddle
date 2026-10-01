import {createClient} from '../supabase/server';

type Row=Record<string,unknown>;

export interface MusicCommissioningRepository {
  listPlatformAccounts(userId:string,projectId:string):Promise<Row[]>;
  listCatalogReleases(userId:string,projectId:string):Promise<Row[]>;
  listReceipts(userId:string,projectId:string):Promise<Row[]>;
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
