#!/usr/bin/env node
/** Research-only touchdown market outcome classifier.
 * "Anytime scorer" counts TDs scored by the named player, NOT passing TDs thrown.
 * "First touchdown scorer" requires a verified play-by-play first scorer.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export function gradeArchivedTouchdownProps(board,result){
 if(board?.schema_version!=='jhadina.sports.touchdown_props.archived.v1')throw Error('TD_BOARD_INVALID');
 if(result?.schema_version!=='jhadina.sports.td_outcomes.official.v1')throw Error('TD_OUTCOME_SCHEMA_INVALID');
 if(result.case_id!==board.case_id||result.event_id!==board.event_id)throw Error('TD_EVENT_MISMATCH');
 if(result.status!=='FINAL'||!/^https:\/\//.test(result.source_url||'')||
    result.official_source_reviewed!==true)throw Error('TD_OFFICIAL_RESULT_REQUIRED');
 if(!Array.isArray(result.player_outcomes))throw Error('TD_PLAYER_OUTCOMES_REQUIRED');
 const verified=Date.parse(result.verified_at_utc),kickoff=Date.parse(result.kickoff_utc);
 if(!Number.isFinite(verified)||!Number.isFinite(kickoff)||verified<=kickoff)throw Error('TD_RESULT_CLOCK_INVALID');
 const keyed=new Map();
 for(const x of result.player_outcomes){
  if(!x.team||!x.player||typeof x.played!=='boolean'||(x.touchdowns_scored!==null&&
     (!Number.isInteger(x.touchdowns_scored)||x.touchdowns_scored<0)))throw Error('TD_PLAYER_OUTCOME_INVALID');
  const id=x.team+'|'+x.player;
  if(keyed.has(id))throw Error('TD_DUPLICATE_PLAYER');
  if(x.played===false&&x.touchdowns_scored!==null)throw Error('TD_DNP_STATS_CONFLICT');
  keyed.set(id,x);
 }
 const first=result.first_touchdown_scorer;
 const firstVerified=first?.official_play_by_play_reviewed===true&&/^https:\/\//.test(first?.play_by_play_url||'')&&
  Number.isFinite(Date.parse(first?.available_at_utc))&&Date.parse(first.available_at_utc)<=verified&&Date.parse(first.available_at_utc)>=kickoff;
 if(first?.official_play_by_play_reviewed===true&&!firstVerified)throw Error('TD_FIRST_SCORER_EVIDENCE_INVALID');
 if(firstVerified){
  const bothNull=first.scorer_team===null&&first.scorer_player===null;
  const bothNamed=typeof first.scorer_team==='string'&&first.scorer_team.trim()&&
      typeof first.scorer_player==='string'&&first.scorer_player.trim();
  if(!bothNull&&!bothNamed)throw Error('TD_FIRST_SCORER_IDENTITY_INVALID');
 }
 const rows=board.odds.map(m=>{
  const player=keyed.get(m.team+'|'+m.player);
  let resultClass='OFFICIAL_STAT_MISSING';
  if(player?.played===false)resultClass='DNP_SETTLEMENT_RULE_REQUIRED';
  else if(m.market==='FIRST_TOUCHDOWN_SCORER'){
   if(firstVerified){
    if(first.scorer_team===null&&first.scorer_player===null)resultClass='NO_TOUCHDOWN_SCORED_IN_GAME';
    else resultClass=first.scorer_team===m.team&&first.scorer_player===m.player?'YES_OCCURRED':'NO_OCCURRED';
   }else resultClass='FIRST_SCORER_PLAY_BY_PLAY_MISSING';
  }else if(m.market==='ANYTIME_TOUCHDOWN_SCORER'){
   if(player?.played===true&&player.touchdowns_scored!==null)
    resultClass=player.touchdowns_scored>=1?'YES_OCCURRED':'NO_OCCURRED';
  }else throw Error('UNKNOWN_TD_MARKET');
  return {id:m.id,player:m.player,team:m.team,market:m.market,
   original_american_odds:m.american_odds,raw_implied_probability:m.raw_implied_probability,
   official_result:resultClass,
   player_inactive_reported:m.player_inactive_reported,
   wager_settlement_certified:false,
   prop_forecast_issued_pre_kickoff:false,forecast_accuracy:null,
   evidence_url:result.source_url,
   notes:'Outcome classification only; source publication clock uncertain, book rules and original yes/no forecast absent.'}
 });
 const counts={};for(const r of rows)counts[r.official_result]=(counts[r.official_result]||0)+1;
 return {schema_version:'jhadina.sports.td_props.research_scorecard.v1',
  case_id:board.case_id,event_id:board.event_id,total_markets:rows.length,
  summary:counts,rows,source_url:result.source_url,verified_at_utc:result.verified_at_utc,
  independently_locked_market_quote:false,
  no_risk_or_wager_recommendation:true,canExecute:false,canTrainAutomatically:false}
}
const main=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(main){
 const [boardPath,resultPath,outPath]=process.argv.slice(2);
 if(!boardPath||!resultPath){console.error('Usage: node grade-touchdowns.mjs ARCHIVED_TD_BOARD OFFICIAL_TD_OUTCOMES [OUTPUT]');process.exitCode=2}
 else{
  try{
   const result=gradeArchivedTouchdownProps(JSON.parse(readFileSync(boardPath,'utf8')),
     JSON.parse(readFileSync(resultPath,'utf8')));
   const output=JSON.stringify(result,null,2)+'\n';
   if(outPath)writeFileSync(outPath,output,{flag:'wx'});else process.stdout.write(output)
  }catch(e){console.error(e.message);process.exitCode=1}
 }
}
