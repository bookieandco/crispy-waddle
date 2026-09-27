import type { DecisionProposal } from "@jhadina/core-spine"
import type { SportsHistoryScope, SportsHistoryView } from "@jhadina/money-core"
import { createProductionSportsHistoryProvider, type SportsHistoryProvider } from "./sports-history-provider"

export type AskSportsHistoryIntent=Readonly<{
  matched:true
  rawQuery:string
  league?:string
  statKeys:readonly string[]
  scopes:readonly SportsHistoryScope[]
}>

export type AskSportsHistoryResult=Readonly<{
  proposal:DecisionProposal
  view?:SportsHistoryView
  intent:AskSportsHistoryIntent
  verified:true
  verificationReason:string
}>

const LEAGUES:Readonly<Record<string,string>>=Object.freeze({
  nba:"nba",wnba:"wnba",nfl:"nfl",mlb:"mlb",nhl:"nhl",cfb:"cfb",
  "college football":"cfb",mbb:"mbb","college basketball":"mbb",wbb:"wbb",
  mls:"mls",epl:"epl","premier league":"epl",ucl:"ucl","champions league":"ucl",
  nwsl:"nwsl","la liga":"laliga",laliga:"laliga",bundesliga:"bundesliga",
  "serie a":"seriea","ligue 1":"ligue1",
})
const STAT_ALIASES:Readonly<Record<string,string>>=Object.freeze({
  points:"points",rebounds:"rebounds",assists:"assists",steals:"steals",blocks:"blocks",
  turnovers:"turnovers",minutes:"minutes",goals:"goals",shots:"shots",saves:"saves",
  "passing yards":"passing_yards","rushing yards":"rushing_yards","receiving yards":"receiving_yards",
  receptions:"receptions",targets:"targets","passing touchdowns":"passing_touchdowns",
  "rushing touchdowns":"rushing_touchdowns","receiving touchdowns":"receiving_touchdowns",
  "home runs":"home_runs",hits:"hits","strikeouts":"strikeouts","runs":"runs",
})

function normalize(v:string){return v.toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim()}

export function inspectAskSportsHistoryIntent(activeTask:string):AskSportsHistoryIntent|null{
  const text=normalize(activeTask)
  const historySignal=/\b(all time|career|history|historical|gamelog|game log|last \d+|playoffs?|postseason|season stats?|stats?|statistics)\b/.test(text)
  const sportSignal=Object.keys(LEAGUES).some(k=>text.includes(k))||/\b(player|team|athlete|vs|versus|against)\b/.test(text)
  if(!historySignal||!sportSignal)return null

  let league:string|undefined
  for(const key of Object.keys(LEAGUES).sort((a,b)=>b.length-a.length)){
    if(text.includes(key)){league=LEAGUES[key];break}
  }
  const scopes:SportsHistoryScope[]=[]
  if(/\ball time\b/.test(text))scopes.push({kind:"ALL_TIME"})
  else if(/\bcareer\b/.test(text))scopes.push({kind:"CAREER"})
  const last=text.match(/\blast\s+(\d+)\b/)
  if(last)scopes.push({kind:"LAST_N",count:Math.min(100000,Math.max(1,Number(last[1])))})
  const season=text.match(/\b(19|20)\d{2}\b/)
  if(season)scopes.push({kind:"SEASON",season:season[0]})
  if(/\b(playoff|playoffs|postseason)\b/.test(text))scopes.push({kind:"PLAYOFFS"})
  if(/\bhome\b/.test(text))scopes.push({kind:"VENUE",venue:"HOME"})
  if(/\baway\b/.test(text))scopes.push({kind:"VENUE",venue:"AWAY"})
  const vs=activeTask.match(/\b(?:vs\.?|versus|against)\s+([^,.;?]+?)(?:\s+(?:in|during|last|all|career|stats?|history)\b|$)/i)
  if(vs?.[1]?.trim())scopes.push({kind:"VS_OPPONENT",opponentLabel:vs[1].trim()})
  if(!scopes.length)scopes.push({kind:"CAREER"})

  const statKeys=Object.entries(STAT_ALIASES)
    .filter(([phrase])=>text.includes(phrase))
    .map(([,key])=>key)
  return Object.freeze({
    matched:true,
    rawQuery:activeTask,
    ...(league?{league}:{}),
    statKeys:Object.freeze([...new Set(statKeys)]),
    scopes:Object.freeze(scopes),
  })
}

function render(view:SportsHistoryView):string{
  const entity=view.records[0]?.entityLabel??view.query.entityId
  const coverage=view.coverage.firstEventDate&&view.coverage.lastEventDate
    ? view.coverage.firstEventDate.slice(0,10)+" → "+view.coverage.lastEventDate.slice(0,10)
    : "no event coverage"
  const lines=[
    entity+" — historical stats",
    "Coverage: "+coverage+" | "+view.coverage.totalRecords.toLocaleString()+" stat records | "+view.coverage.seasons.length+" seasons",
    "Complete all-time coverage certified: "+(view.allTimeAvailable?"yes":"no"),
  ]
  for(const s of view.summaries.slice(0,16)){
    lines.push(
      s.statLabel+" ("+s.statKey+"): n="+s.sampleSize+
      " | mean "+s.mean.toFixed(2)+
      " | median "+s.p50.toFixed(2)+
      " | P10–P90 "+s.p10.toFixed(2)+"–"+s.p90.toFixed(2)
    )
  }
  if(view.summaries.length>16)lines.push("Additional stat series: "+(view.summaries.length-16))
  if(view.warnings.length)lines.push("Limits: "+view.warnings.join(" "))
  return lines.join("\n")
}

export async function handleAskSportsHistoryCommand(
  input:{userId:string;activeTask:string},
  overrides:{provider?:SportsHistoryProvider;now?:()=>Date}={},
):Promise<AskSportsHistoryResult|null>{
  const intent=inspectAskSportsHistoryIntent(input.activeTask)
  if(!intent)return null
  const now=overrides.now??(()=>new Date())
  const provider=overrides.provider??createProductionSportsHistoryProvider()
  const view=await provider.query({
    rawQuery:intent.rawQuery,
    scopes:intent.scopes,
    statKeys:intent.statKeys,
    asOf:now().toISOString(),
    ...(intent.league?{league:intent.league}:{}),
  })
  if(!view){
    const proposal:DecisionProposal={
      id:"ask-sports-history:"+crypto.randomUUID(),
      contextId:"sports-history-context:"+crypto.randomUUID(),
      disposition:"ASK",
      recommendation:intent.league
        ?"I recognized the sports-history request, but the historical provider could not resolve that player/team or has no admissible records."
        :"Tell me the league too (for example NBA, NFL, MLB, NHL, WNBA, CFB or EPL) so I can resolve the athlete without guessing.",
      rationale:"Historical lookup fails closed when entity/league/data coverage is ambiguous.",
      evidence:[],
      uncertainty:["No historical stat view was generated."],
      alternatives:["Specify the league and player name.","Open Sports and select the player/team, then ask for all-time history."],
    }
    return {proposal,intent,verified:true,verificationReason:"History intent recognized but no canonical history view was resolved."}
  }
  const proposal:DecisionProposal={
    id:"ask-sports-history:"+crypto.randomUUID(),
    contextId:"sports-history-context:"+view.viewId,
    disposition:"PROCEED",
    recommendation:render(view),
    rationale:"Jhadina queried the canonical historical ledger with explicit scope and point-in-time filtering. Historical records remain evidence only unless separately admitted and calibrated as SPORT-SIM features.",
    evidence:view.evidenceIds.slice(0,32).map(id=>({id,source:"sports-history",observedAt:now().toISOString(),summary:"Historical sports evidence"})),
    uncertainty:view.warnings,
    alternatives:["Change the time window or split.","Compare this history with the current SPORT-SIM distribution."],
  }
  return {proposal,view,intent,verified:true,verificationReason:"Canonical sports-history view resolved from read-only provider evidence."}
}
