import {SOURCE_ID,requireSourceOperation} from './source-policy.mjs';
requireSourceOperation(SOURCE_ID,'PROBE_PROVIDER');
const u='https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard?dates=20261012';
const res=await fetch(u,{signal:AbortSignal.timeout(10000)});
if(!res.ok)throw Error('HTTP_'+res.status);
const d=await res.json();
const competitions=(d.events||[]).flatMap(e=>(e.groupings||[]).flatMap(g=>g.competitions||[]));
const selected=competitions.filter(c=>c.status?.type?.completed===true).slice(0,5);
console.log(JSON.stringify({events:d.events?.length,competitions:competitions.length,completed:competitions.filter(c=>c.status?.type?.completed===true).length,
 examples:selected.map(c=>({keys:Object.keys(c).slice(0,25),status:c.status?.type?.name,competitors:c.competitors?.slice(0,2).map(x=>({keys:Object.keys(x).slice(0,25),score:x.score,linescores_length:x.linescores?.length,athlete_present:!!x.athlete,winner:x.winner}))}))},null,2));