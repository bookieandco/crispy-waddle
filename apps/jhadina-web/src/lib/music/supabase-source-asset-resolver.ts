import type { MediaAsset, MusicSource, SourceAssetResolver, Track } from "@jhadina/music-core";
import type { SupabaseClient } from "@supabase/supabase-js";
/** Resolves only user-owned persisted assets; provider credentials and arbitrary URLs never cross this boundary. */
export class SupabaseSourceAssetResolver implements SourceAssetResolver {
  constructor(private readonly userId:string, private readonly db:SupabaseClient) {}
  async resolve(source:MusicSource,track:Track):Promise<MediaAsset|null>{
    if(!this.userId||source.userId!==this.userId||!source.authorized)return null;
    const {data,error}=await this.db.from("music_assets").select("id,user_id,track_id,source_id,kind,uri,mime_type,codec,bitrate,lossless,duration_ms,provenance").eq("user_id",this.userId).eq("track_id",track.id).eq("source_id",source.id).limit(1).maybeSingle();
    if(error)throw error;if(!data||data.user_id!==this.userId||data.track_id!==track.id||data.source_id!==source.id)return null;
    return {id:String(data.id),trackId:String(data.track_id),sourceId:String(data.source_id),kind:data.kind as MediaAsset["kind"],uri:String(data.uri),mimeType:data.mime_type??undefined,codec:data.codec??undefined,bitrate:data.bitrate??undefined,lossless:data.lossless??undefined,durationMs:data.duration_ms??undefined,provenance:data.provenance??{}};
  }
}
