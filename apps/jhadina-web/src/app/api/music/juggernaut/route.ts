import {NextRequest,NextResponse} from 'next/server';
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity';
import {createMusicJuggernautRepository} from '@/lib/music/music-juggernaut-repository';
import {loadMusicJuggernautProjection} from '@/lib/music/music-juggernaut-service';

export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const artistKey=req.nextUrl.searchParams.get('artistKey')?.trim();
    if(!artistKey)return NextResponse.json({success:false,error:'artistKey is required'},{status:400});
    const data=await loadMusicJuggernautProjection({userId:identity.userId,artistKey});
    return NextResponse.json({success:true,data});
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to load Music Juggernaut';
    return NextResponse.json({success:false,error:message},{status:message.toLowerCase().includes('auth')?401:500});
  }
}

export async function POST(req:NextRequest){
  try{
    await (await createRequestIdentityVerifier()).verify({});
    const body=await req.json() as {operation?:string;payload?:Record<string,unknown>};
    if(!body.operation||!body.payload)return NextResponse.json({success:false,error:'operation and payload are required'},{status:400});
    const repo=createMusicJuggernautRepository();
    const p=body.payload;
    let data:Record<string,unknown>;
    switch(body.operation){
      case 'upsert_project':
        data=await repo.upsertProject({artistKey:String(p.artistKey??''),name:String(p.name??''),mode:p.mode==='ATTACK'?'ATTACK':'SEARCH',metadata:objectValue(p.metadata)});break;
      case 'upsert_song':
        data=await repo.upsertSong({projectId:String(p.projectId??''),songKey:String(p.songKey??''),title:String(p.title??''),releaseStatus:String(p.releaseStatus??'unreleased'),campaignState:String(p.campaignState??'INGESTED'),artistConviction:Number(p.artistConviction??0.5),rightsState:String(p.rightsState??'review_required'),sections:arrayValue(p.sections),evidenceRefs:stringArray(p.evidenceRefs),releaseDate:optionalString(p.releaseDate)});break;
      case 'upsert_experiment':
        data=await repo.upsertExperiment({projectId:String(p.projectId??''),songId:String(p.songId??''),experimentKey:String(p.experimentKey??''),sectionKey:optionalString(p.sectionKey),hypothesis:String(p.hypothesis??''),contentFamily:String(p.contentFamily??''),platform:String(p.platform??''),audience:optionalString(p.audience),spendMinor:Number(p.spendMinor??0),currency:String(p.currency??'USD'),sampleTarget:Number(p.sampleTarget??100),successSignal:String(p.successSignal??''),failureSignal:String(p.failureSignal??''),status:String(p.status??'planned'),evidenceRefs:stringArray(p.evidenceRefs)});break;
      case 'record_observation':
        data=await repo.recordObservation({projectId:String(p.projectId??''),experimentId:String(p.experimentId??''),observationKey:String(p.observationKey??''),observedAt:String(p.observedAt??new Date().toISOString()),metrics:objectValue(p.metrics),botRisk:Number(p.botRisk??0),attributionConfidence:Number(p.attributionConfidence??0.5),evidenceRefs:stringArray(p.evidenceRefs)});break;
      case 'upsert_city_demand':
        data=await repo.upsertCityDemand({projectId:String(p.projectId??''),cityKey:String(p.cityKey??''),cityName:String(p.cityName??''),listeners:Number(p.listeners??0),directFans:Number(p.directFans??0),showInterest:Number(p.showInterest??0),priorAttendees:Number(p.priorAttendees??0),repeatFans:Number(p.repeatFans??0),evidenceRefs:stringArray(p.evidenceRefs),observedAt:String(p.observedAt??new Date().toISOString())});break;
      case 'upsert_rights':
        data=await repo.upsertRights({projectId:String(p.projectId??''),assetKey:String(p.assetKey??''),masterOwnershipKnown:Boolean(p.masterOwnershipKnown),publishingKnown:Boolean(p.publishingKnown),sampleStatus:String(p.sampleStatus??'review_required'),thirdPartyUsageStatus:String(p.thirdPartyUsageStatus??'review_required'),evidenceRefs:stringArray(p.evidenceRefs)});break;
      case 'upsert_learning':{
        const status=p.status==='validated'||p.status==='rejected'?p.status:'provisional';
        data=await repo.upsertLearning({projectId:String(p.projectId??''),learningKey:String(p.learningKey??''),status,confidence:Number(p.confidence??0.5),finding:String(p.finding??''),reusableSignals:objectValue(p.reusableSignals),evidenceRefs:stringArray(p.evidenceRefs)});break;
      }
      default:return NextResponse.json({success:false,error:'unsupported operation'},{status:400});
    }
    return NextResponse.json({success:true,data});
  }catch(error){
    const message=error instanceof Error?error.message:'Music Juggernaut write failed';
    return NextResponse.json({success:false,error:message},{status:message.toLowerCase().includes('auth')?401:400});
  }
}

function objectValue(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function arrayValue(value:unknown):unknown[]{return Array.isArray(value)?value:[];}
function stringArray(value:unknown):string[]{return Array.isArray(value)?value.map(String).filter(Boolean):[];}
function optionalString(value:unknown):string|undefined{return typeof value==='string'&&value.trim()?value:undefined;}
