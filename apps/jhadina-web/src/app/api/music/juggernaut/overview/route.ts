import { NextResponse } from 'next/server';
import {
  buildDailyArtistQueue,
  buildSongSectionHeatmap,
  chooseJuggernautMode,
  detectCreativeOutlier,
  rankSongs,
  recommendVenueCapacity,
  type CreativeOutlier,
} from '@jhadina/growth-core';
import { createRequestIdentityVerifier } from '@/lib/auth/request-identity';
import { createJuggernautRepository } from '@/lib/music/juggernaut-repository';

export const dynamic='force-dynamic';

export async function GET(){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const repository=createJuggernautRepository();
    const snapshot=await repository.getSnapshot(identity.userId,'bookie');

    const experimentById=new Map(snapshot.experiments.map((experiment)=>[experiment.id,experiment]));
    const grouped=new Map<string,number[]>();
    for(const observation of snapshot.observations){
      const experiment=experimentById.get(observation.experimentId);
      if(!experiment)continue;
      const values=grouped.get(experiment.contentFamily)??[];
      values.push(observation.views);
      grouped.set(experiment.contentFamily,values);
    }
    const outliers:CreativeOutlier[]=snapshot.observations.map((observation)=>{
      const experiment=experimentById.get(observation.experimentId);
      const values=experiment?grouped.get(experiment.contentFamily)??[]:[];
      const sorted=[...values].sort((a,b)=>a-b);
      const median=sorted.length?sorted[Math.floor(sorted.length/2)]!:Math.max(1,observation.views);
      return detectCreativeOutlier(observation,{
        medianViews:median,
        medianSongActions:Math.max(1,Math.round(median*0.03)),
        medianDirectFanCaptures:Math.max(1,Math.round(median*0.005)),
        minimumExposures:250,
      });
    });
    const mode=snapshot.breakout?'ATTACK':chooseJuggernautMode({outliers});
    const enriched={...snapshot,mode};
    const rankedSongs=rankSongs(snapshot.songs,snapshot.observations,snapshot.experiments);
    const heatmaps=rankedSongs.slice(0,5).map((song)=>({
      songId:song.id,
      sections:buildSongSectionHeatmap({song,experiments:snapshot.experiments,observations:snapshot.observations}),
    }));
    const live=snapshot.cityDemand.slice(0,10).map(recommendVenueCapacity);
    const queue=buildDailyArtistQueue(enriched);

    return NextResponse.json({success:true,data:{snapshot:enriched,outliers,rankedSongs,heatmaps,live,queue}});
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to load Music Juggernaut';
    return NextResponse.json({success:false,error:message},{status:message.includes('Authenticated')?401:500});
  }
}
