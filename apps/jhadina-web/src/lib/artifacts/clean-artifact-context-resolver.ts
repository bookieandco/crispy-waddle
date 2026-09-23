import type { SupabaseClient } from "@supabase/supabase-js"
import type { EphemeralArtifactContext } from "@jhadina/core-spine"

export type DurableArtifactRef={id:string}
export class CleanArtifactContextResolver{
 constructor(private readonly client:SupabaseClient,private readonly ownerUserId:string){}
 async resolve(refs:DurableArtifactRef[]):Promise<EphemeralArtifactContext[]>{
  if(!refs.length)return[]
  const ids=[...new Set(refs.map(r=>r.id).filter(Boolean))].slice(0,8)
  const {data,error}=await this.client.from("jhadina_artifacts").select("id,original_name,detected_mime_type,status,scanned_at,extracted_text_ref").eq("owner_user_id",this.ownerUserId).in("id",ids)
  if(error)throw new Error(`ARTIFACT_CONTEXT_READ_FAILED: ${error.message}`)
  const rows=data??[]
  const found=new Set(rows.map(r=>r.id))
  const missing=ids.filter(id=>!found.has(id));if(missing.length)throw new Error("ARTIFACT_CONTEXT_NOT_FOUND")
  const unclean=rows.filter(r=>r.status!=="clean");if(unclean.length)throw new Error("ARTIFACT_CONTEXT_NOT_CLEAN")
  return rows.map(r=>({id:r.id,kind:r.detected_mime_type?.startsWith("image/")?"image":"text",mimeType:r.detected_mime_type,source:"file-picker",name:r.original_name,observedAt:r.scanned_at??new Date(0).toISOString(),...(r.extracted_text_ref?{text:`[extracted artifact reference: ${r.extracted_text_ref}]`}:{})}))
 }
}
