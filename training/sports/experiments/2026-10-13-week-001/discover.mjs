import {mkdir,writeFile} from 'node:fs/promises';
import {normalizeFixture} from './pipeline.mjs';
const feeds=[
 ['NFL','football/nfl'],['NCAAF','football/college-football'],['NBA','basketball/nba'],['NHL','hockey/nhl'],['MLB','baseball/mlb'],
 ['Soccer','soccer/eng.1'],['Soccer','soccer/esp.1'],['Soccer','soccer/usa.1'],['Tennis','tennis/atp'],['Tennis','tennis/wta'],['UFC','mma/ufc']
];
const today=new Date();
const start=new Date(Math.max(today.getTime(),Date.parse('2026-10-13T00:00:00-07:00')));
const end=new Date('2026-10-21T00:00:00-07:00');
const dateCode=d=>d.toISOString().slice(0,10).replaceAll('-','');
const days=[];for(let d=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),start.getUTCDate()));d<end;d.setUTCDate(d.getUTCDate()+1))days.push(dateCode(d));
const fixtures=[],errors=[];
for(const [sport,league] of feeds){
 for(const day of days){
  const url='https://site.api.espn.com/apis/site/v2/sports/'+league+'/scoreboard?dates='+day;
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{accept:'application/json'}});
   if(!response.ok)throw Error('HTTP_'+response.status);
   const observed=new Date().toISOString(),data=await response.json();
   for(const e of data.events||[]){
    const c=e.competitions?.[0]?.competitors||[];
    const home=c.find(x=>x.homeAway==='home'),away=c.find(x=>x.homeAway==='away');
    if(!home||!away||!e.date||!e.id)continue;
    const event={sport,event_id:'espn:'+league+':'+e.id,home:home.team?.displayName||home.team?.name,away:away.team?.displayName||away.team?.name,start_utc:e.date,source_url:url,source_observed_at:observed,source_class:'THIRD_PARTY_SCHEDULE_UNCONFIRMED',season_type:e.season?.type??null};
    try{const normalized=normalizeFixture(event,observed);if(Date.parse(normalized.start_utc)>Date.now()&&Date.parse(normalized.start_utc)<end)fixtures.push(normalized)}catch(err){errors.push({league,event_id:e.id,error:String(err.message)})}
   }
  }catch(err){errors.push({league,day,error:String(err.message)})}
 }
}
const unique=[...new Map(fixtures.map(x=>[x.event_id,x])).values()].sort((a,b)=>a.start_utc.localeCompare(b.start_utc));
const report={schema_version:'jhadina.sports.schedule_discovery.v1',observed_at:new Date().toISOString(),experiment_id:'JH-SPORTS-WEEK-2026-10-13-001',source_quality:'THIRD_PARTY_UNCONFIRMED',fixtures:unique,errors,forecast_count:0,bet_count:0,warning:'Discovery only. ESPN schedule does not independently establish official fixtures, market prices, player props, or model forecasts. No predictions sealed.'};
await mkdir('sports-lab-output',{recursive:true});await writeFile('sports-lab-output/discovery.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({fixtures:unique.length,errors:errors.length,forecast_count:0,bet_count:0}));
if(!unique.length)process.exitCode=1;
