#!/usr/bin/env node
// Archived research-market coverage, source lineage, and duplicate audit. No wagering.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const key=x=>[x.team,x.player,x.metric,x.period].join('|');
const implied=n=>n<0?-n/(-n+100):100/(n+100);
export function auditNflPropCoverage(board,alt,td,splits){
 if(board?.schema_version!=='jhadina.sports.prop_board.archived.v1'||
   alt?.schema_version!=='jhadina.sports.prop_context.archived.v1'||
   td?.schema_version!=='jhadina.sports.touchdown_props.archived.v1'||
   splits?.schema_version!=='jhadina.sports.prop_public_betting_splits.v1')throw Error('PROP_SCHEMA_INVALID');
 if(![alt,td,splits].every(x=>x.case_id===board.case_id&&x.event_id===board.event_id))throw Error('PROP_EVENT_MISMATCH');
 if(board.source.first_capture!=='AFTER_KICKOFF'||board.source.use_as_original_forecast_input!==false||
   board.no_wager_authority!==true)throw Error('PREGAME_AUTHORITY_INVALID');
 if(board.markets.length!==board.market_count||td.odds.length!==td.market_count||
   splits.splits.length!==splits.snapshot_count)throw Error('COUNTS_INCONSISTENT');
 const ids=new Map(),lines=new Map();
 for(const m of board.markets){
  if(ids.has(m.market_id)||!Number.isFinite(m.threshold))throw Error('DUPLICATE_OR_INVALID_MARKET');
  if(m.quote_available_at_utc!==null||m.price_over_american!==null||m.price_under_american!==null)throw Error('FABRICATED_LOCKED_MARKET');
  ids.set(m.market_id,m);
  const list=lines.get(key(m))||[];
  if(list.some(x=>x.threshold===m.threshold))throw Error('DUPLICATE_MARKET_THRESHOLD');
  list.push({threshold:m.threshold,source:m.archive_source});lines.set(key(m),list);
 }
 const seen=new Set();
 for(const s of splits.splits){
  if(seen.has(s.linked_numeric_market_id)||!ids.has(s.linked_numeric_market_id))throw Error('PUBLIC_SPLIT_UNMATCHED');
  seen.add(s.linked_numeric_market_id);
  const match=ids.get(s.linked_numeric_market_id);
  if(key(match)!==key(s)||match.threshold!==s.threshold)throw Error('PUBLIC_SPLIT_LINE_MISMATCH');
  for(const v of [s.percent_handle_over,s.percent_handle_under,s.percent_bets_over,s.percent_bets_under]){
   if(!Number.isFinite(v)||v<0||v>100)throw Error('PUBLIC_SPLIT_PERCENT_INVALID');
  }
  if(Math.abs(s.percent_handle_over+s.percent_handle_under-100)>.11||
     Math.abs(s.percent_bets_over+s.percent_bets_under-100)>.11)throw Error('PUBLIC_SPLIT_SUM_INVALID');
 }
 if(splits.observation_semantics?.not_model_probabilities!==true||
   splits.observation_semantics?.n_bets_unknown!==true)throw Error('PUBLIC_SPLIT_MEANING_INVALID');
 const tdIds=new Set();
 for(const x of td.odds){
  if(tdIds.has(x.id)||!['FIRST_TOUCHDOWN_SCORER','ANYTIME_TOUCHDOWN_SCORER'].includes(x.market))throw Error('TD_MARKET_INVALID');
  tdIds.add(x.id);
  if(!Number.isInteger(x.american_odds)||Math.abs(implied(x.american_odds)-x.raw_implied_probability)>1e-6)throw Error('TD_IMPLIED_PROBABILITY_INVALID');
  if(x.price_locked_at_kickoff!==false||x.market_is_two_sided_over_under!==false)throw Error('TD_UNVERIFIED_MARKET_LOCK');
 }
 for(const m of alt.alternate_line_reports){
  if(!Number.isFinite(m.reported_threshold)||m.valid_as_locked_pregame_quote!==false)throw Error('ALTERNATE_LINE_INVALID');
  const list=lines.get(key(m))||[];
  list.push({threshold:m.reported_threshold,source:m.source_url});lines.set(key(m),list);
 }
 const variations=[...lines.entries()].filter(([,xs])=>new Set(xs.map(x=>x.threshold)).size>1)
   .map(([dimension,xs])=>({dimension,thresholds:[...new Set(xs.map(x=>x.threshold))].sort((a,b)=>a-b)}));
 return {
  schema_version:'jhadina.sports.prop_coverage_audit.v1',case_id:board.case_id,event_id:board.event_id,
  numeric_ou_line_observations:board.market_count,
  tracked_players:new Set(board.markets.map(x=>x.team+'|'+x.player)).size,
  numeric_stat_categories:new Set(board.markets.map(x=>x.metric)).size,
  numeric_periods:[...new Set(board.markets.map(x=>x.period))].sort(),
  alternative_line_observations:alt.alternate_line_reports.length,
  touchdown_binary_market_observations:td.market_count,
  selected_public_over_under_split_observations:splits.snapshot_count,
  same_player_metric_different_reported_line_count:variations.length,
  line_variations:variations,entire_sportsbook_market_coverage:false,
  documented_gaps:board.unavailable_or_not_yet_ingested,
  no_proven_betting_edge:true,calibrated:false,training_authority:'NONE',canExecute:false
 };
}
const main=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(main){
 const files=process.argv.slice(2);
 if(files.length!==4){console.error('Usage: node audit-prop-coverage.mjs NUMERIC.json ALTERNATIVES.json TD.json SPLITS.json');process.exitCode=2}
 else{
  try{
   const args=files.map(f=>JSON.parse(readFileSync(f,'utf8')));
   process.stdout.write(JSON.stringify(auditNflPropCoverage(...args),null,2)+'\n');
  }catch(e){console.error(e.message);process.exitCode=1}
 }
}
