import {NextResponse} from 'next/server';
import {buildMomentsPilot,type MomentsSectionProof} from '@jhadina/growth-core';
import type {RightsRecord} from '@jhadina/growth-core';
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity';
import {loadMusicJuggernautProjection} from '@/lib/music/music-juggernaut-service';

export const runtime='nodejs';
export const dynamic='force-dynamic';
type Row=Record<string,unknown>;
const noStore={'Cache-Control':'private, no-store, max-age=0'};
function refs(raw:unknown):string[]{
  return Array.isArray(raw)?raw.filter((x):x is string=>typeof x==='string'&&x.trim().length>0):[];
}
/** Owner-scoped read only: no Director job, Social proposal, ad spend or provider call. */
export async function GET(){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const projection=await loadMusicJuggernautProjection({
      userId:identity.userId,artistKey:'atwood-bookie',
    });
    if(!projection)return NextResponse.json({
      success:false,error:'MOMENTS_OWNER_PROJECT_MISSING',
    },{status:404,headers:noStore});
    const moments=projection.rankedSongs.filter(song=>song.title.trim().toLowerCase()==='moments');
    const song=moments.length===1?moments[0]:null;
    const original=projection.songs.find(row=>String(row.id)===song?.id);
    const rawRights=projection.rights.find(row=>song&&
      (String(row.asset_key)===String(original?.song_key) || String(row.asset_id)===song.id));
    const rights:RightsRecord|null=song&&rawRights?{
      assetId:song.id,masterOwnershipKnown:rawRights.master_ownership_known===true,
      publishingKnown:rawRights.publishing_known===true,
      sampleStatus:status(rawRights.sample_status),
      thirdPartyUsageStatus:status(rawRights.third_party_usage_status),
      evidenceRefs:refs(rawRights.evidence_refs),
    }:null;
    // Imported section rows must include explicit, measured audio provenance;
    // a catalog title or guessed time range never counts as a proof.
    const sectionProofs:MomentsSectionProof[]=[];
    if(song&&original&&Array.isArray(original.sections)){
      for(const part of original.sections){
        if(!part||typeof part!=='object')continue;
        const value=part as Row;
        if(value.measuredFromOwnedAudio!==true||typeof value.audioSha256!=='string'||
          typeof value.analysisReceiptRef!=='string'||typeof value.id!=='string')continue;
        sectionProofs.push({songId:song.id,sectionId:value.id,
          audioSha256:value.audioSha256,analysisReceiptRef:value.analysisReceiptRef,
          measuredFromOwnedAudio:true});
      }
    }
    const pilot=buildMomentsPilot({
      songs:song?[song]:[],rights,sectionProofs,
      // These need independent approval + provider evidence and are NOT inferred.
      directorProof:null,socialReadbacks:null,measuredOutcomes:null,
    });
    return NextResponse.json({success:true,data:pilot},{headers:noStore});
  }catch(error){
    const message=error instanceof Error?error.message:'';
    const unauthorized=/auth|session|identity|unauthorized/i.test(message);
    return NextResponse.json({success:false,error:unauthorized?
      'Authentication required':'Moments pilot evidence unavailable'},{
      status:unauthorized?401:503,headers:noStore,
    });
  }
}
function status(value:unknown):RightsRecord['sampleStatus']{
  if(value==='none'||value==='cleared'||value==='blocked')return value;
  return 'review_required';
}
