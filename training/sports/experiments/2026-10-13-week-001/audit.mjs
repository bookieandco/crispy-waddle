import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
export function verifyDiscovery(d){
 if(d?.schema_version!=='jhadina.sports.schedule_discovery.v1'||!Array.isArray(d.fixtures)||!Array.isArray(d.errors))throw Error('DISCOVERY_SCHEMA');
 const seen=new Set();
 for(const f of d.fixtures){
  if(!f.event_id||seen.has(f.event_id)||!['NFL','NCAAF','NBA','NHL','MLB','Soccer','Tennis','UFC'].includes(f.sport)||f.source_class!=='THIRD_PARTY_SCHEDULE_UNCONFIRMED')throw Error('DISCOVERY_INVALID_EVENT');
  seen.add(f.event_id);
 }
 return {events:d.fixtures.length,errors:d.errors.length,source_quality:'THIRD_PARTY_UNCONFIRMED',prediction_admission:'BLOCKED'};
}
export function verifyForecastReceipt(s){
 const {sha256,...data}=s||{};
 if(!sha256||sha(JSON.stringify(data))!==sha256||s.authority!=='PAPER_ONLY'||s.real_bet!==false)throw Error('FORECAST_RECEIPT_INVALID');
 if(!(Date.parse(s.sealed_at_utc)<Date.parse(s.start_utc)))throw Error('FORECAST_LATE');
 return {event_id:s.event_id,sha256,valid:true};
}
if(process.argv[1]?.endsWith('/audit.mjs')){
 const data=JSON.parse(readFileSync(process.argv[2],'utf8'));
 console.log(JSON.stringify(verifyDiscovery(data)));
}
