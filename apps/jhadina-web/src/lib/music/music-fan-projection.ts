import type {SupabaseClient} from '@supabase/supabase-js';
import {createClient} from '../supabase/server';

export type MusicFanStage='VIEWER'|'FOLLOWER'|'RETURNER'|'LISTENER'|'DIRECT_FAN'|'COMMUNITY'|'BUYER'|'ADVOCATE';

export interface MusicFanAudienceProjection{
  brandId:string;
  total:number;
  directlyReachable:number;
  ownedShare:number;
  stageCounts:Readonly<Record<MusicFanStage,number>>;
  channelCounts:Readonly<Record<'email'|'sms'|'whatsapp'|'social_dm',number>>;
  evidenceRefs:readonly string[];
  limitations:readonly string[];
}

export async function loadMusicFanAudienceProjection(input:{userId:string;brandId:string},clientOverride?:SupabaseClient):Promise<MusicFanAudienceProjection>{
  const db=clientOverride??await createClient();
  const {data,error}=await db.from('jhadina_growth_customers')
    .select('id,lifecycle_stage,consent,first_seen_at,last_seen_at')
    .eq('user_id',input.userId).eq('brand_id',input.brandId).limit(5000);
  if(error)throw new Error('MUSIC_FAN_PROJECTION_FAILED:'+error.message);
  const rows=(data??[]) as Array<Record<string,unknown>>;
  const stages:Record<MusicFanStage,number>={VIEWER:0,FOLLOWER:0,RETURNER:0,LISTENER:0,DIRECT_FAN:0,COMMUNITY:0,BUYER:0,ADVOCATE:0};
  const channels={email:0,sms:0,whatsapp:0,social_dm:0};
  let directlyReachable=0;
  for(const row of rows){
    const stage=mapStage(String(row.lifecycle_stage??'prospect'));
    stages[stage]+=1;
    const consent=row.consent&&typeof row.consent==='object'&&!Array.isArray(row.consent)?row.consent as Record<string,unknown>:{};
    let reachable=false;
    for(const channel of Object.keys(channels) as Array<keyof typeof channels>){
      if(consent[channel]===true){channels[channel]+=1;reachable=true;}
    }
    if(reachable)directlyReachable+=1;
  }
  return Object.freeze({
    brandId:input.brandId,
    total:rows.length,
    directlyReachable,
    ownedShare:rows.length?round(directlyReachable/rows.length):0,
    stageCounts:Object.freeze(stages),
    channelCounts:Object.freeze(channels),
    evidenceRefs:Object.freeze(rows.slice(0,100).map((row)=>'growth-customer:'+String(row.id))),
    limitations:Object.freeze([
      'Projection exposes aggregate relationship state only; raw customer keys are intentionally excluded.',
      'ADVOCATE and COMMUNITY require richer relationship evidence than the generic Growth lifecycle currently stores, so they are not inferred from vanity engagement.',
    ]),
  });
}

export async function recordMusicFanConsent(input:{
  brandId:string;
  customerKey:string;
  channel:'email'|'sms'|'whatsapp'|'social_dm';
  granted:boolean;
  evidenceRef:string;
  occurredAt?:string;
}):Promise<{customerId:string;stage:string}>{
  if(!input.evidenceRef.trim())throw new Error('MUSIC_FAN_CONSENT_EVIDENCE_REQUIRED');
  const db=await createClient();
  const {data,error}=await db.rpc('jhadina_growth_set_customer_consent',{
    p_brand_id:input.brandId,p_customer_key:input.customerKey,p_channel:input.channel,p_granted:input.granted,
    p_evidence_ref:input.evidenceRef,p_occurred_at:input.occurredAt??new Date().toISOString(),
  }).single();
  if(error||!data)throw new Error('MUSIC_FAN_CONSENT_WRITE_FAILED:'+(error?.message??'no row'));
  const row=data as Record<string,unknown>;
  return Object.freeze({customerId:String(row.id),stage:String(row.lifecycle_stage)});
}

function mapStage(stage:string):MusicFanStage{
  switch(stage){
    case 'vip':case 'repeat_customer':case 'customer':return 'BUYER';
    case 'lead':return 'DIRECT_FAN';
    case 'engaged':return 'RETURNER';
    case 'at_risk':return 'RETURNER';
    case 'churned':return 'VIEWER';
    case 'prospect':default:return 'FOLLOWER';
  }
}
function round(value:number):number{return Math.round(value*10000)/10000;}
