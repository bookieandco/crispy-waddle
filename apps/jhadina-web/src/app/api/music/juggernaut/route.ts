import {NextRequest,NextResponse} from 'next/server';
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity';
import {createMusicJuggernautRepository} from '@/lib/music/music-juggernaut-repository';
import {
  certifyMusicJuggernautCore,
  detectCreativeOutlier,
  chooseJuggernautMode,
  recommendVenueCapacity,
} from '@jhadina/growth-core';

export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const artistKey=req.nextUrl.searchParams.get('artistKey')?.trim();
    if(!artistKey)return NextResponse.json({success:false,error:'artistKey is required'},{status:400});
    const repo=createMusicJuggernautRepository();
    const project=await repo.getProject(identity.userId,artistKey);
    if(!project)return NextResponse.json({success:true,data:{project:null,certification:certifyMusicJuggernautCore()}});
    const projectId=String(project.id);
    const [songs,experiments,observations,cityDemand,rights,learning]=await Promise.all([
      repo.listSongs(identity.userId,projectId),repo.listExperiments(identity.userId,projectId),repo.listObservations(identity.userId,projectId),
      repo.listCityDemand(identity.userId,projectId),repo.listRights(identity.userId,projectId),repo.listLearning(identity.userId,projectId),
    ]);
    const experimentRows=experiments.map((row)=>({id:String(row.experiment_key),songId:String(row.song_id),dbId:String(row.id)}));
    const experimentByDb=new Map(experimentRows.map((row)=>[row.dbId,row]));
    const outliers=observations.map((row)=>{
      const exp=experimentByDb.get(String(row.experiment_id));
      if(!exp)return null;
      return detectCreativeOutlier({
        id:String(row.id),experimentId:exp.id,exposures:Number(row.exposures??0),views:Number(row.views??0),engagedViews:row.engaged_views==null?undefined:Number(row.engaged_views),
        shares:Number(row.shares??0),saves:Number(row.saves??0),comments:Number(row.comments??0),profileVisits:Number(row.profile_visits??0),
        songActions:Number(row.song_actions??0),directFanCaptures:Number(row.direct_fan_captures??0),purchases:row.purchases==null?undefined:Number(row.purchases),
        revenueMinor:row.revenue_minor==null?undefined:Number(row.revenue_minor),botRisk:Number(row.bot_risk??0),
        attributionConfidence:Number(row.attribution_confidence??0),observedAt:String(row.observed_at),
        evidenceRefs:Array.isArray(row.evidence_refs)?row.evidence_refs.map(String):[],
      },{medianViews:Math.max(1,median(observations.map((x)=>Number(x.views??0)))),medianSongActions:Math.max(1,median(observations.map((x)=>Number(x.song_actions??0)))),medianDirectFanCaptures:Math.max(1,median(observations.map((x)=>Number(x.direct_fan_captures??0)))),minimumExposures:100});
    }).filter((value):value is NonNullable<typeof value>=>Boolean(value));
    const venues=cityDemand.map((row)=>recommendVenueCapacity({
      city:String(row.city_name),listeners:Number(row.listeners??0),directFans:Number(row.direct_fans??0),showInterest:Number(row.show_interest??0),
      priorAttendees:Number(row.prior_attendees??0),repeatFans:Number(row.repeat_fans??0),evidenceRefs:Array.isArray(row.evidence_refs)?row.evidence_refs.map(String):[],
    }));
    return NextResponse.json({success:true,data:{project,songs,experiments,observations,cityDemand,rights,learning,outliers,mode:chooseJuggernautMode({outliers}),venues,certification:certifyMusicJuggernautCore()}});
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
      default:return NextResponse.json({success:false,error:'unsupported operation'},{status:400});
    }
    return NextResponse.json({success:true,data});
  }catch(error){
    const message=error instanceof Error?error.message:'Music Juggernaut write failed';
    return NextResponse.json({success:false,error:message},{status:message.toLowerCase().includes('auth')?401:400});
  }
}

function median(values:number[]):number{if(!values.length)return 0;const s=[...values].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]??0:((s[m-1]??0)+(s[m]??0))/2;}
function objectValue(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function arrayValue(value:unknown):unknown[]{return Array.isArray(value)?value:[];}
function stringArray(value:unknown):string[]{return Array.isArray(value)?value.map(String).filter(Boolean):[];}
function optionalString(value:unknown):string|undefined{return typeof value==='string'&&value.trim()?value:undefined;}
