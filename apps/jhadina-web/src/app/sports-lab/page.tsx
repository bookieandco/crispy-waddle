import Link from "next/link"

export const revalidate=300

type Entry={name:string;type:string}
type Market={market:string;status:string}
type RunReport={
 run_id:string;started_at_utc:string;completed_at_utc:string;
 discovered_fixtures:number;research_forecasts_created:number;preliminary_grades_created:number;
 market_coverage?:Market[];sport_coverage?:string[];coherence_flags?:unknown[];
 diagnostics?:{fetched:number;requested:number;error_count:number};
 placed_bets:number;virtual_bankroll_usd:number;official_settlements:number;market_quotes:number
}
const ROOT="https://api.github.com/repos/bookieandco/crispy-waddle/contents/training/sports/paper-ledger/week001"
const RUNS="https://github.com/bookieandco/crispy-waddle/tree/main/training/sports/paper-ledger/week001/runs"
const FORECASTS="https://github.com/bookieandco/crispy-waddle/tree/main/training/sports/paper-ledger/week001/forecasts"
const ACTIONS="https://github.com/bookieandco/crispy-waddle/actions/workflows/jhadina-sports-lab-week001.yml"

async function entries(folder:string):Promise<Entry[]>{
 try{
  const r=await fetch(ROOT+"/"+folder+"?ref=main",{
    next:{revalidate:300},headers:{Accept:"application/vnd.github+json"}
  })
  if(!r.ok)return []
  const data:unknown=await r.json()
  return Array.isArray(data)?data.filter((e:unknown):e is Entry=>
    Boolean(e)&&typeof e==="object"&&
    typeof (e as Entry).name==="string"&&(e as Entry).type==="file"):[]
 }catch{return []}
}
async function readLatestRun(list:Entry[]):Promise<RunReport|null>{
 const candidates=list.map(x=>x.name).filter(x=>/^\d{8,20}-\d{1,4}\.json$/.test(x))
 candidates.sort((a,b)=>Number(b.split("-")[0])-Number(a.split("-")[0]))
 if(!candidates.length)return null
 try{
  const url="https://raw.githubusercontent.com/bookieandco/crispy-waddle/main/training/sports/paper-ledger/week001/runs/"+candidates[0]
  const r=await fetch(url,{next:{revalidate:300}})
  if(!r.ok)return null
  const data=await r.json() as RunReport
  return data?.placed_bets===0&&data?.virtual_bankroll_usd===3100&&
   typeof data.run_id==="string"&&typeof data.completed_at_utc==="string"?data:null
 }catch{return null}
}
const label=(market:string)=>({
 winner:"Winner",spread:"Spread",game_total:"Game total",player_props:"Player props",
 period_props:"Period props",touchdowns_or_scorers:"Touchdowns / scorers"
 } as Record<string,string>)[market]||market
export default async function SportsLabPage(){
 const [forecasts,runs,grades]=await Promise.all([entries("forecasts"),entries("runs"),entries("preliminary")])
 const latest=await readLatestRun(runs)
 const statuses=latest?.market_coverage||[]
 const active=latest!==null
 return <main className="jh-page">
  <div className="jh-wrap">
   <p className="jh-eyebrow">Jhadina · Capital Lab · Research</p>
   <h1 className="jh-title">Sports Lab</h1>
   <p className="jh-copy">Week 001 · October 13–20, 2026 · Eight sports, six research markets.
    Forecasts are uncalibrated and use third-party observations. No official odds,
    certified settlement, real wagers, or model-weight updates.</p>
   <div className="jh-row" style={{marginTop:16}}>
    <span className={active?"jh-status jh-status--success":"jh-status jh-status--warning"}>
     {active?"Published research ledger":"No verified run receipt available"}
    </span>
    <span className="jh-status">Paper only · $3,100 virtual · $0 staked</span>
   </div>
   <div className="jh-grid">
    <article className="jh-card jh-card--third"><div className="jh-metric">{forecasts.length}</div><p className="jh-label">Sealed research forecasts</p></article>
    <article className="jh-card jh-card--third"><div className="jh-metric">{grades.length}</div><p className="jh-label">Preliminary result receipts</p></article>
    <article className="jh-card jh-card--third"><div className="jh-metric">{runs.length}</div><p className="jh-label">Durable run receipts</p></article>
    <article className="jh-card jh-card--wide">
     <h2 className="jh-card-title">Latest verified run</h2>
     {latest?<div>
      <p className="jh-card-copy">Run {latest.run_id} · {new Date(latest.completed_at_utc).toLocaleString("en-US",{timeZone:"America/Los_Angeles",dateStyle:"medium",timeStyle:"short"})} Pacific</p>
      <p className="jh-card-copy">Discovered {latest.discovered_fixtures} fixtures · {latest.research_forecasts_created} new forecasts · {latest.preliminary_grades_created} provisional grades</p>
      <p className="jh-card-copy">Feed requests {latest.diagnostics?.fetched??"?"}/{latest.diagnostics?.requested??"?"} · Errors and exclusions {latest.diagnostics?.error_count??"?"} · Model consistency flags {latest.coherence_flags?.length??0}</p>
      <p className="jh-card-copy">Sport categories observed: {(latest.sport_coverage||[]).join(", ")||"Unavailable"}</p>
     </div>:<p className="jh-card-copy">The GitHub ledger is temporarily unavailable or there is no readable run receipt. Check the Actions log before relying on current status.</p>}
    </article>
    <article className="jh-card jh-card--wide">
     <h2 className="jh-card-title">Six-market coverage</h2>
     <div className="jh-list">
      {statuses.length?statuses.map(item=><div key={item.market} className="jh-item jh-between">
       <strong>{label(item.market)}</strong>
       <span className="jh-status jh-status--warning">{item.status.replaceAll("_"," ").toLowerCase()}</span>
      </div>):<p className="jh-card-copy">No current evidence of a licensed market feed. Markets remain blocked.</p>}
     </div>
    </article>
    <article className="jh-card jh-card--wide">
     <h2 className="jh-card-title">Owner controls</h2>
     <p className="jh-card-copy">Automatic discovery is scheduled during the research and grading period. You can inspect runs from your iPhone; the phone does not need to stay on.</p>
     <div className="jh-row" style={{marginTop:14}}>
      <a className="jh-button jh-button--primary" href={ACTIONS} target="_blank" rel="noopener noreferrer">Cloud runs</a>
      <a className="jh-button" href={FORECASTS} target="_blank" rel="noopener noreferrer">Sealed forecasts</a>
      <a className="jh-button" href={RUNS} target="_blank" rel="noopener noreferrer">Run receipts</a>
      <Link className="jh-button" href="/money/command-center">Money Core</Link>
     </div>
    </article>
   </div>
   <p className="jh-meta" style={{marginTop:24}}>Read-only view of public GitHub experiment records, refreshed approximately every five minutes. Availability of historical results does not verify data-use rights or establish forecast accuracy.</p>
  </div>
 </main>
}
