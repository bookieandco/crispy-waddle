const url='https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard?dates=20261013';
const res=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{accept:'application/json'}});
if(!res.ok)throw Error('PROBE_HTTP_'+res.status);
const d=await res.json();
const shape=x=>x?{keys:Object.keys(x).slice(0,24),id:x.id??null,date:x.date??null,
  status:x.status?.type?.name??null,competitions_count:x.competitions?.length??0,
  competitors_count:x.competitors?.length??0,
  first_competition:x.competitions?.[0]?{keys:Object.keys(x.competitions[0]).slice(0,24),id:x.competitions[0].id,date:x.competitions[0].date,competitors_count:x.competitions[0].competitors?.length??0,first_competitor_keys:Object.keys(x.competitions[0].competitors?.[0]||{})}:null,
  first_competitor_keys:Object.keys(x.competitors?.[0]||{})}:null;
console.log(JSON.stringify({http_status:res.status,events_count:d.events?.length??null,
  examples:(d.events||[]).slice(0,3).map(shape),top_keys:Object.keys(d).slice(0,20)},null,2));
