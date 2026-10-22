import {NextRequest,NextResponse} from 'next/server';
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity';
import {createClient} from '@/lib/supabase/server';
import {loadMusicJuggernautProjection} from '@/lib/music/music-juggernaut-service';
import {buildMusicCrossCorePlan} from '@/lib/music/music-cross-core-bridge';
import {createContentProjectRepository} from '@/lib/social/content-project-repository';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const ARTIST_KEY='atwood-bookie';
const headers={'Cache-Control':'private, no-store, max-age=0'};

async function prepare(input:{userId:string;songKey:string;directorProjectId?:string}){
  if(!/^catalog:[a-z0-9][a-z0-9-]{0,180}$/.test(input.songKey))
    throw new Error('MUSIC_CROSS_CORE_SONG_KEY_INVALID');
  const projection=await loadMusicJuggernautProjection({
    userId:input.userId,artistKey:ARTIST_KEY,
  });
  if(!projection)throw new Error('MUSIC_CROSS_CORE_PROJECT_NOT_FOUND');
  const catalogRow=projection.songs.find(row=>row.song_key===input.songKey);
  if(!catalogRow)throw new Error('MUSIC_CROSS_CORE_SONG_NOT_FOUND');
  const song=projection.rankedSongs.find(row=>row.id===String(catalogRow.id));
  if(!song)throw new Error('MUSIC_CROSS_CORE_SONG_MODEL_UNAVAILABLE');
  if(input.directorProjectId){
    const db=await createClient();
    const {data,error}=await db.from('director_production_projects').select('id')
      .eq('owner_user_id',input.userId).eq('id',input.directorProjectId).maybeSingle();
    if(error||!data)throw new Error('MUSIC_CROSS_CORE_DIRECTOR_PROJECT_NOT_OWNED');
  }
  return buildMusicCrossCorePlan({
    projectId:String(projection.project.id),
    song,songKey:input.songKey,rights:projection.rights,
    createdAt:new Date().toISOString(),directorProjectId:input.directorProjectId,
  });
}

function failure(cause:unknown){
  const message=cause instanceof Error?cause.message:'MUSIC_CROSS_CORE_ERROR';
  const status=/auth|session|identity|unauthorized/i.test(message)?401:
    /INVALID/.test(message)?400:/NOT_FOUND|NOT_OWNED|UNAVAILABLE/.test(message)?404:503;
  // Hide privileged database failures and anything outside our bounded codes.
  const error=message.startsWith('MUSIC_CROSS_CORE_')?message:
    status===401?'Authentication required':'Music creative workspace unavailable';
  return NextResponse.json({success:false,error},{status,headers});
}

/** Read-only current-song preview across Music, Social, Director and ads. */
export async function GET(req:NextRequest){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const songKey=req.nextUrl.searchParams.get('songKey')??'catalog:moments';
    const directorProjectId=req.nextUrl.searchParams.get('directorProjectId')??undefined;
    const plan=await prepare({userId:identity.userId,songKey,directorProjectId});
    const db=await createClient();
    const {data:projects,error:projectError}=await db.from('director_production_projects')
      .select('id,title,status').eq('owner_user_id',identity.userId)
      .order('updated_at',{ascending:false}).limit(25);
    return NextResponse.json({
      success:true,data:plan,staged:false,
      directorProjects:projectError?[]:(projects??[]),
      directorProjectOptionsState:projectError?'unavailable':'ready',
    },{headers});
  }catch(error){return failure(error);}
}

/** Explicit owner action: create missing Social drafts only. Never overwrites
 * human-edited drafts and never calls Director, Social publish or paid APIs. */
export async function POST(req:NextRequest){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const body=await req.json() as {songKey?:unknown;directorProjectId?:unknown};
    if(typeof body.songKey!=='string'||body.songKey.length>190||
      (body.directorProjectId!==undefined&&
        (typeof body.directorProjectId!=='string'||body.directorProjectId.length>240)))
      throw new Error('MUSIC_CROSS_CORE_INPUT_INVALID');
    const plan=await prepare({
      userId:identity.userId,songKey:body.songKey,
      directorProjectId:body.directorProjectId as string|undefined,
    });
    const repo=createContentProjectRepository();
    const existing=await repo.list(identity.userId);
    const byId=new Map(existing.map(item=>[item.project.id,item.project]));
    const created:string[]=[],preserved:string[]=[];
    for(const variant of plan.variants){
      const id=variant.socialProject.id;
      const stored=byId.get(id);
      if(stored){
        if(stored.brand!=='atwood-bookie')throw new Error('MUSIC_CROSS_CORE_STORED_BRAND_MISMATCH');
        preserved.push(id);
      }else{
        await repo.save(identity.userId,variant.socialProject);
        created.push(id);
      }
    }
    return NextResponse.json({
      success:true,
      data:{
        songKey:plan.songKey,songId:plan.songId,
        createdSocialDraftIds:created,preservedSocialDraftIds:preserved,
        directorBriefs:plan.variants.flatMap(v=>v.directorBrief?[v.directorBrief]:[]),
        paidDraftEligibility:'NOT_ESTABLISHED',
        musicExperimentStatus:'NOT_DISPATCHED',
        publicationAuthority:'NONE',adSpendAuthority:'NONE',
        externalActionsStarted:false,
        blockers:plan.blockers,
      },
    },{status:201,headers});
  }catch(error){return failure(error);}
}
