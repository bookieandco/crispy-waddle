#!/usr/bin/env node
/**
 * Archived NFL prop O/U research grader. Never infers performance or a winning bet.
 * Takes independently verified FINAL player-stat evidence; if absent -> UNRESOLVED.
 * No wagers, returns, profit or model calibration are produced.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const key=(t,n)=>t+'|'+n;
const statKey=(period,metric)=>period+'|'+metric;
const sums={
 passing_plus_rushing_yards:['passing_yards','rushing_yards'],
 rushing_plus_receiving_yards:['rushing_yards','receiving_yards'],
};
const instant=(s,name)=>{const t=Date.parse(s);if(!Number.isFinite(t))throw Error(name+'_INVALID');return t};
const sourceIsHttps=u=>typeof u==='string'&&/^https:\/\//i.test(u);

export function gradeArchivedNflProps(board,official){
 if(board?.schema_version!=='jhadina.sports.prop_board.archived.v1')throw Error('PROP_BOARD_SCHEMA_INVALID');
 if(official?.schema_version!=='jhadina.sports.official_player_stats.v1')throw Error('PROP_STAT_SCHEMA_INVALID');
 if(official.case_id!==board.case_id||official.event_id!==board.event_id)throw Error('PROP_EVENT_MISMATCH');
 if(official.status!=='FINAL'||official.evidence_class!=='OFFICIAL_RESULT_REVIEWED'||
    !sourceIsHttps(official.source_url)||!Array.isArray(official.players))throw Error('PROP_OFFICIAL_FINAL_REQUIRED');
 const verifiedAt=instant(official.verified_at_utc,'OFFICIAL_STATS_VERIFIED_AT');
 const kickoff=instant(official.kickoff_utc,'KICKOFF');
 if(verifiedAt<=kickoff)throw Error('PROP_STATS_BEFORE_KICKOFF');
 if(official.source_verified_by_reviewer!==true)throw Error('PROP_STATS_HUMAN_SOURCE_REVIEW_REQUIRED');
 const playerMap=new Map();
 for(const p of official.players){
  if(!p.team||!p.player||typeof p.played!=='boolean'||!Array.isArray(p.statistics))throw Error('PROP_PLAYER_STAT_SCHEMA_INVALID');
  const k=key(p.team,p.player);
  if(playerMap.has(k))throw Error('PROP_DUPLICATE_PLAYER');
  const stats=new Map();
  for(const st of p.statistics){
   if(!['FULL','FIRST_HALF','Q1'].includes(st.period)||!st.metric||
     !Number.isFinite(st.value)||!sourceIsHttps(st.evidence_url))throw Error('PROP_STAT_EVIDENCE_INVALID');
   const available=instant(st.available_at_utc,'PROP_STAT_AVAILABLE_AT');
   if(available>verifiedAt||available<kickoff)throw Error('PROP_STAT_TIME_INCONSISTENT');
   const sk=statKey(st.period,st.metric);
   if(stats.has(sk))throw Error('PROP_DUPLICATE_STAT');
   stats.set(sk,st);
  }
  playerMap.set(k,{played:p.played,stats,team:p.team,player:p.player});
 }
 const ids=new Set(),rows=[];
 for(const m of board.markets){
  if(ids.has(m.market_id))throw Error('PROP_DUPLICATE_MARKET');
  ids.add(m.market_id);
  if(typeof m.player!=='string'||!m.player.trim()||!m.team||
    !['FULL','FIRST_HALF','Q1'].includes(m.period)||!m.metric||
    typeof m.threshold!=='number'||!Number.isFinite(m.threshold))throw Error('PROP_LINE_INVALID');
  if(m.price_over_american!==null||m.price_under_american!==null)throw Error('PROP_BOARD_PRICE_UNVERIFIED');
  const player=playerMap.get(key(m.team,m.player));
  let value=null,actualSource=[],resolution='OFFICIAL_STAT_MISSING',derivation=null;
  if(player){
   if(!player.played){resolution='DNP_SETTLEMENT_RULE_UNKNOWN'}
   else {
    const direct=player.stats.get(statKey(m.period,m.metric));
    if(direct){value=direct.value;actualSource=[direct.evidence_url];derivation='DIRECT_OFFICIAL_STAT'}
    else if(sums[m.metric]){
      const parts=sums[m.metric].map(part=>player.stats.get(statKey(m.period,part)));
      if(parts.every(Boolean)){
        value=parts.reduce((a,x)=>a+x.value,0);
        actualSource=[...new Set(parts.map(x=>x.evidence_url))];
        derivation='SUM_OF_SAME_PERIOD_VERIFIED_COMPONENTS';
      }
    }
    if(value!==null)resolution=value>m.threshold?'OVER_RESULT':value<m.threshold?'UNDER_RESULT':'PUSH_RESULT';
   }
  }
  const needsRule=resolution==='DNP_SETTLEMENT_RULE_UNKNOWN'||m.market_state==='INACTIVE_NEEDS_BOOK_VOID_RULE';
  rows.push({
   market_id:m.market_id,team:m.team,player:m.player,metric:m.metric,period:m.period,
   archived_threshold:m.threshold,bookmaker:m.bookmaker,actual:value,
   classification:needsRule?'DNP_OR_INACTIVE_SETTLEMENT_REVIEW':resolution,
   computed_direction:value===null?null:resolution,
   verified_stat_sources:actualSource,calculation:derivation,
   void_rule_checked:false,book_settlement_verified:false,
   forecast_issued_for_this_prop:false,
   model_predicted_side:null,model_prediction_correct:null,
   status_note:needsRule?'An inactive or DNP market may be void or may follow book-specific rules. Do not grade as an automatic under.':value===null?'No valid same-period official player stat available; do not treat as zero.':'Descriptive comparison to archived published line; not a bet or forecasting result.'
  });
 }
 const counts={OVER_RESULT:0,UNDER_RESULT:0,PUSH_RESULT:0,OFFICIAL_STAT_MISSING:0,DNP_OR_INACTIVE_SETTLEMENT_REVIEW:0};
 for(const r of rows)counts[r.classification]=(counts[r.classification]||0)+1;
 return {
  schema_version:'jhadina.sports.prop_ou_research_scorecard.v1',
  case_id:board.case_id,event_id:board.event_id,
  stat_source_url:official.source_url,
  stats_verified_at_utc:official.verified_at_utc,
  board_source_url:board.source.url,
  original_prop_forecasts_present:false,
  original_pregame_winner_forecast_unchanged:true,
  provenance_warning:'These prop lines were archived after kickoff with unknown exact publication times. Results are descriptive market comparisons, not valid backtested picks.',
  count:rows.length,summary:counts,rows,
  no_wager_return_estimates:true,no_auto_training:true,canExecute:false
 };
}
const main=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(main){
 const [boardPath,statsPath,out]=process.argv.slice(2);
 if(!boardPath||!statsPath){console.error('Usage: node grade-props.mjs ARCHIVED_BOARD.json OFFICIAL_PLAYER_STATS.json [OUTPUT]');process.exitCode=2}
 else {
  try{
   const report=gradeArchivedNflProps(JSON.parse(readFileSync(boardPath,'utf8')),
     JSON.parse(readFileSync(statsPath,'utf8')));
   const output=JSON.stringify(report,null,2)+'\n';
   if(out)writeFileSync(out,output,{flag:'wx'});else process.stdout.write(output);
  }catch(e){console.error(e.message);process.exitCode=1}
 }
}
