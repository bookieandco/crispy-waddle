import {NextRequest,NextResponse} from 'next/server';
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity';
import {createMusicDirectorPackage} from '@/lib/music/music-director-bridge';
import type {MusicVisualAspectRatio,MusicVisualDeliverable} from '@jhadina/director-core/music-visual-production';
import type {TranscriptCue} from '@jhadina/director-core/transcript-assisted-lip-sync';

export const dynamic='force-dynamic';

type Body=Record<string,unknown>;

export async function POST(req:NextRequest){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const body=await req.json() as Body;
    const deliverable=parseDeliverable(body.deliverable);
    const data=await createMusicDirectorPackage({
      userId:identity.userId,
      songKey:requiredText(body.songKey,'songKey'),
      deliverable,
      audioAssetId:requiredText(body.audioAssetId,'audioAssetId'),
      audioUri:requiredText(body.audioUri,'audioUri'),
      audioDurationSeconds:positiveNumber(body.audioDurationSeconds,'audioDurationSeconds'),
      vocalStemAssetId:optionalText(body.vocalStemAssetId),
      vocalStemUri:optionalText(body.vocalStemUri),
      timedLyrics:parseCues(body.timedLyrics),
      concept:requiredText(body.concept,'concept'),
      styleReferenceAssets:parseAssets(body.styleReferenceAssets),
      artistReferenceAssets:parseAssets(body.artistReferenceAssets),
      targetAspectRatios:parseRatios(body.targetAspectRatios),
      targetTeaserCount:optionalPositiveInt(body.targetTeaserCount),
      lipSyncRequested:body.lipSyncRequested===true,
      lyricOverlayRequested:body.lyricOverlayRequested===true,
      characterPerformanceRequested:body.characterPerformanceRequested===true,
      createStyleFrames:body.createStyleFrames!==false,
      experimentKey:optionalText(body.experimentKey),
      parentDirectorJobId:optionalText(body.parentDirectorJobId),
      submit:body.submit!==false,
    });
    return NextResponse.json({success:true,data});
  }catch(error){
    const message=error instanceof Error?error.message:'Music Director request failed';
    return NextResponse.json({success:false,error:message},{status:message.toLowerCase().includes('auth')?401:400});
  }
}

function parseDeliverable(value:unknown):MusicVisualDeliverable{
  if(value==='lyric_video'||value==='teaser_pack'||value==='music_video'||value==='visualizer')return value;
  throw new Error('deliverable must be lyric_video, teaser_pack, music_video, or visualizer');
}
function parseCues(value:unknown):TranscriptCue[]{
  if(value===undefined||value===null)return [];
  if(!Array.isArray(value))throw new Error('timedLyrics must be an array');
  return value.map((raw,index)=>{
    if(!raw||typeof raw!=='object')throw new Error('invalid timed lyric at '+index);
    const row=raw as Record<string,unknown>;
    const startMs=integer(row.startMs,'timedLyrics['+index+'].startMs');
    const endMs=integer(row.endMs,'timedLyrics['+index+'].endMs');
    const confidence=row.confidence===undefined?undefined:Number(row.confidence);
    if(confidence!==undefined&&(!Number.isFinite(confidence)||confidence<0||confidence>1)){
      throw new Error('invalid timed lyric confidence at '+index);
    }
    return {
      id:requiredText(row.id,'timedLyrics['+index+'].id'),
      startMs,endMs,
      text:requiredText(row.text,'timedLyrics['+index+'].text'),
      ...(confidence!==undefined?{confidence}:{}),
    };
  });
}
function parseAssets(value:unknown):Array<{id:string;uri:string}>{
  if(value===undefined||value===null)return [];
  if(!Array.isArray(value))throw new Error('reference assets must be an array');
  return value.map((raw,index)=>{
    if(!raw||typeof raw!=='object')throw new Error('invalid reference asset at '+index);
    const row=raw as Record<string,unknown>;
    return {id:requiredText(row.id,'reference id'),uri:requiredText(row.uri,'reference uri')};
  });
}
function parseRatios(value:unknown):MusicVisualAspectRatio[]|undefined{
  if(value===undefined||value===null)return undefined;
  if(!Array.isArray(value))throw new Error('targetAspectRatios must be an array');
  return value.map((item)=>{
    if(item==='16:9'||item==='9:16'||item==='1:1')return item;
    throw new Error('invalid target aspect ratio');
  });
}
function requiredText(value:unknown,field:string):string{
  if(typeof value!=='string'||!value.trim())throw new Error(field+' is required');
  return value.trim();
}
function optionalText(value:unknown):string|undefined{
  return typeof value==='string'&&value.trim()?value.trim():undefined;
}
function positiveNumber(value:unknown,field:string):number{
  const n=Number(value);
  if(!Number.isFinite(n)||n<=0)throw new Error(field+' must be positive');
  return n;
}
function optionalPositiveInt(value:unknown):number|undefined{
  if(value===undefined||value===null||value==='')return undefined;
  const n=Number(value);
  if(!Number.isInteger(n)||n<=0)throw new Error('targetTeaserCount must be a positive integer');
  return n;
}
function integer(value:unknown,field:string):number{
  const n=Number(value);
  if(!Number.isInteger(n)||n<0)throw new Error(field+' must be a non-negative integer');
  return n;
}
