import type { SupabaseClient } from "@supabase/supabase-js";
import {
  initializeMusicDawSession, validateMusicDawSession,
  type MusicDawSession, type MusicDawAsset,
} from "@jhadina/music-core";
import { SupabaseMusicRestorationArtifactStore } from "./restoration-supabase-store";

async function ownerAssets(client: SupabaseClient, ownerUserId: string, caseId: string) {
  const store = new SupabaseMusicRestorationArtifactStore(client, ownerUserId);
  const restorationCase = await store.getCase(caseId);
  if (!restorationCase) throw new Error("MUSIC_DAW_CASE_NOT_FOUND");
  const originals = await store.listArtifacts(caseId);
  const assets: MusicDawAsset[] = originals.map(a => ({
    id:a.id,sha256:a.contentHash,role:a.role,kind:a.kind,mimeType:a.mimeType,
    sampleRate:a.sampleRate,sampleCount:a.sampleCount,
  }));
  const urls = await Promise.all(originals.map(async a => ({
    artifactId:a.id, downloadUrl:await store.createArtifactDownloadUrl(a.id),
  })));
  return { assets,urls, title:String(restorationCase.title) };
}
export async function getMusicDawOwnerSession(input: {
  client: SupabaseClient; ownerUserId: string; caseId: string;
}) {
  const {assets,urls,title}=await ownerAssets(input.client,input.ownerUserId,input.caseId);
  const {data,error}=await input.client.from("music_daw_sessions")
    .select("document,revision").eq("case_id",input.caseId)
    .eq("owner_user_id",input.ownerUserId).maybeSingle();
  if(error)throw new Error("MUSIC_DAW_STORAGE_READ_FAILED:"+error.message);
  const document:MusicDawSession=data
    ? validateMusicDawSession(data.document as MusicDawSession,input.caseId,assets)
    : initializeMusicDawSession(input.caseId,assets);
  if(data && document.revision!==Number(data.revision))
    throw new Error("MUSIC_DAW_STORED_REVISION_INVALID");
  return {document,assets,urls,title,persisted:!!data};
}
export async function saveMusicDawOwnerSession(input: {
  client: SupabaseClient; ownerUserId: string; caseId: string;
  expectedRevision: number; mutationId: string; document: MusicDawSession;
}) {
  if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0 ||
     !input.mutationId.trim()||input.mutationId.length>240 ||
     input.document.revision!==input.expectedRevision) {
    throw new Error("MUSIC_DAW_REVISION_OR_MUTATION_INVALID");
  }
  const {assets}=await ownerAssets(input.client,input.ownerUserId,input.caseId);
  const doc=validateMusicDawSession(input.document,input.caseId,assets);
  const {data,error}=await input.client.rpc("save_music_daw_session",{
    p_case_id:input.caseId,p_owner_user_id:input.ownerUserId,
    p_expected_revision:input.expectedRevision,p_mutation_id:input.mutationId,
    p_document:doc,
  });
  if(error){
    if(/MUSIC_DAW_REVISION_CONFLICT/.test(error.message))throw new Error("MUSIC_DAW_REVISION_CONFLICT");
    throw new Error("MUSIC_DAW_STORAGE_WRITE_FAILED:"+error.message);
  }
  if(!data?.document||Number(data.revision)<1)throw new Error("MUSIC_DAW_SAVE_RECEIPT_INVALID");
  const saved=validateMusicDawSession(data.document as MusicDawSession,input.caseId,assets);
  if(saved.revision!==Number(data.revision))throw new Error("MUSIC_DAW_SAVED_REVISION_MISMATCH");
  return {document:saved,persisted:true};
}
