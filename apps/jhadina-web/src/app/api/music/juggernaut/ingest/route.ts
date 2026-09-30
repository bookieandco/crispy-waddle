import { NextRequest, NextResponse } from 'next/server';
import {
  validateExperimentPlan,
  type BreakoutWindow,
  type CityDemand,
  type ContentExperiment,
  type FanRecord,
  type PerformanceObservation,
  type SongRecord,
} from '@jhadina/growth-core';
import { createRequestIdentityVerifier } from '@/lib/auth/request-identity';
import { createJuggernautRepository } from '@/lib/music/juggernaut-repository';

export const dynamic='force-dynamic';

type IngestBody =
  | {kind:'song';eventKey:string;correlationId:string;data:SongRecord}
  | {kind:'experiment';eventKey:string;correlationId:string;data:ContentExperiment}
  | {kind:'observation';eventKey:string;correlationId:string;data:PerformanceObservation}
  | {kind:'fan';eventKey:string;correlationId:string;data:FanRecord}
  | {kind:'city_demand';eventKey:string;correlationId:string;data:CityDemand}
  | {kind:'breakout';eventKey:string;correlationId:string;data:BreakoutWindow};

export async function POST(req:NextRequest){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const body=await req.json() as IngestBody;
    if(!body?.kind||!body.eventKey?.trim()||!body.correlationId?.trim()||!body.data){
      return NextResponse.json({success:false,error:'kind, eventKey, correlationId, and data are required'},{status:400});
    }
    const repo=createJuggernautRepository();
    switch(body.kind){
      case 'song':
        assertSong(body.data); await repo.upsertSong(identity.userId,body.data); break;
      case 'experiment':
        validateExperimentPlan(body.data); await repo.upsertExperiment(identity.userId,body.data); break;
      case 'observation':
        assertObservation(body.data); await repo.recordObservation(identity.userId,body.data,body.eventKey); break;
      case 'fan':
        assertFan(body.data); await repo.upsertFan(identity.userId,body.data); break;
      case 'city_demand':
        assertCity(body.data); await repo.upsertCityDemand(identity.userId,body.data); break;
      case 'breakout':
        assertBreakout(body.data); await repo.upsertBreakout(identity.userId,body.data); break;
    }
    const event=await repo.appendEvent(identity.userId,{
      eventKey:body.eventKey,eventType:'music.'+body.kind+'.ingested',entityType:body.kind,
      entityId:entityId(body),payload:body.data as unknown as Record<string,unknown>,occurredAt:new Date().toISOString(),
      correlationId:body.correlationId,evidenceRefs:evidenceRefs(body),
    });
    return NextResponse.json({success:true,data:{event}},{status:201});
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to ingest Music Juggernaut evidence';
    return NextResponse.json({success:false,error:message},{status:message.includes('Authenticated')?401:400});
  }
}

function entityId(body:IngestBody):string{
  if(body.kind==='city_demand')return body.data.city;
  if(body.kind==='breakout')return body.data.songId;
  return body.data.id;
}
function evidenceRefs(body:IngestBody):readonly string[]{return body.data.evidenceRefs;}
function assertSong(song:SongRecord):void{
  if(!song.id?.trim()||!song.title?.trim())throw new Error('MUSIC_JUGGERNAUT_SONG_INVALID');
  if(!Number.isFinite(song.artistConviction)||song.artistConviction<0||song.artistConviction>1)throw new Error('MUSIC_JUGGERNAUT_CONVICTION_INVALID');
}
function assertObservation(value:PerformanceObservation):void{
  if(!value.id?.trim()||!value.experimentId?.trim()||!value.evidenceRefs?.length)throw new Error('MUSIC_JUGGERNAUT_OBSERVATION_INVALID');
  for(const rate of [value.botRisk,value.attributionConfidence])if(!Number.isFinite(rate)||rate<0||rate>1)throw new Error('MUSIC_JUGGERNAUT_OBSERVATION_RATE_INVALID');
}
function assertFan(value:FanRecord):void{if(!value.id?.trim()||!value.evidenceRefs?.length)throw new Error('MUSIC_JUGGERNAUT_FAN_INVALID');}
function assertCity(value:CityDemand):void{if(!value.city?.trim()||!value.evidenceRefs?.length)throw new Error('MUSIC_JUGGERNAUT_CITY_INVALID');}
function assertBreakout(value:BreakoutWindow):void{if(!value.songId?.trim()||!value.signals.length||!value.evidenceRefs.length)throw new Error('MUSIC_JUGGERNAUT_BREAKOUT_INVALID');}
