#!/usr/bin/env node
// Jhadina SPORT-CASE.001: scoring only, NEVER wager execution.
// Usage: node scripts/sports-case-evaluate.mjs <pregame-baseline.json> <official-result.json>
// Does NOT fetch/verify the official result. Operator must independently verify it.
import fs from 'node:fs';
import crypto from 'node:crypto';
const fail=(msg)=>{throw new Error('SPORTS_CASE_'+msg);};
if(process.argv.length!==4)fail('USAGE');
const p=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const r=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
if(r.case_id!==p.case_id)fail('CASE_ID_MISMATCH');
if(r.fixture_id && r.fixture_id!==p.fixture.genui_event_id)fail('FIXTURE_ID_MISMATCH');
if(r.status!=='FINAL')fail('OUTCOME_NOT_FINAL');
if(!r.official_source_url?.startsWith('https://'))fail('OFFICIAL_SOURCE_URL_REQUIRED');
if(!r.verified_at || Date.parse(r.verified_at)<=Date.parse(p.fixture.kickoff_utc))fail('VERIFICATION_TIME_INVALID');
if(!Number.isSafeInteger(r.home_score)||r.home_score<0||!Number.isSafeInteger(r.away_score)||r.away_score<0)fail('INVALID_SCORE');
const outcome = r.home_score===r.away_score ? 0.5 : (r.home_score>r.away_score?1:0);
const pred=p.original_prediction, probability=pred.probability_home_win;
if(!(probability>0 && probability<1))fail('PROBABILITY_INVALID');
const projectedMargin=pred.score[p.fixture.home]-pred.score[p.fixture.away];
const observedMargin=r.home_score-r.away_score;
const projectedTotal=pred.projected_total;
const actualTotal=r.home_score+r.away_score;
const predictedHomeWin=probability>0.5;
const actualHomeWin=outcome===1;
const err=(a,b)=>Math.abs(a-b);
const brier=(probability-outcome)**2; // binary home-win probability Brier (not two-category sum)
const logLoss=outcome===0.5?null:-(outcome*Math.log(probability)+(1-outcome)*Math.log(1-probability));
const market=p.ex_ante_market_comparison;
const report={
 schema_version:'JHADINA_SPORTS_CASE_POSTGAME_SCORING_V1',
 case_id:p.case_id,source_baseline_sha256:crypto.createHash('sha256').update(fs.readFileSync(process.argv[2])).digest('hex'),
 result_status:'RESULT_METRICS_ONLY_NOT_CAUSAL_CERTIFICATION',
 result_source:r.official_source_url,verified_at:r.verified_at,match_status:'FINAL',
 projected:{winner:pred.winner,home:p.fixture.home,away:p.fixture.away,
  home_score:pred.score[p.fixture.home],away_score:pred.score[p.fixture.away],
  home_win_probability:probability,total:projectedTotal,home_margin:projectedMargin},
 observed:{winner:outcome===0.5?'TIE':actualHomeWin?p.fixture.home:p.fixture.away,
  home_score:r.home_score,away_score:r.away_score,total:actualTotal,home_margin:observedMargin},
 scores:{winner_correct:outcome===0.5?null:predictedHomeWin===actualHomeWin,
  home_score_absolute_error:err(pred.score[p.fixture.home],r.home_score),
  away_score_absolute_error:err(pred.score[p.fixture.away],r.away_score),
  total_absolute_error:err(projectedTotal,actualTotal),
  margin_absolute_error:err(projectedMargin,observedMargin),
  brier_score:Number(brier.toFixed(6)),log_loss:logLoss===null?null:Number(logLoss.toFixed(6))},
 original_market_reference_context:{
  referenced_home_spread:market.odds.home_spread,
  referenced_total:market.odds.total,
  source_is_not_verified_closing_line:true,
  projected_home_cover_at_original_spread:projectedMargin>Math.abs(market.odds.home_spread),
  observed_home_cover_at_original_spread:observedMargin>Math.abs(market.odds.home_spread),
  projected_over_at_original_total:projectedTotal>market.odds.total,
  observed_over_at_original_total:actualTotal>market.odds.total
 },
 hypothesis_review:p.pregame_questions.map(h=>({id:h.id,claim:h.claim,status:'NEEDS_OFFICIAL_GAME_STATS_AND_CAUSAL_REVIEW',evaluation:null})),
 notes:['Getting the winner right does not prove mechanism or positive betting edge.',
  'Correct process can lose due to variance; lucky guesses can win. Independent review required.',
  'Original forecast is not modified; output is appended as a new postgame artifact.',
  'Do not treat this as evidence of calibrated performance from a single game.'],
 authority:'LEARNING_ONLY',can_execute:false
};
console.log(JSON.stringify(report,null,2));
